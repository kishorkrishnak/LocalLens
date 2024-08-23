const Lens = require("../models/Lens");
const User = require("../models/User");
const Comment = require("../models/Comment");
const mongoose = require("mongoose");

exports.createLens = async (req, res, next) => {
  try {
    const { name, thumbnail, description, location, tags, creator, address } =
      req.body;
    if (!name || !location || !creator) {
      return res.status(400).json({
        status: "error",
        message: "Name, location, and creator are required fields",
        data: null,
      });
    }

    const newLens = await Lens.create({
      name,
      description,
      location,
      thumbnail,
      tags,
      creator,
      address: {
        circleBounds: address?.circleBounds || {},
        circleBoundRadius: address?.circleBoundRadius || 100,

        formatted: address?.formatted || "",
        //store all the address components as an object
        components: address?.components || {},
      },
    });

    const lensCreator = await User.findById(creator);

    if (!lensCreator) {
      return res.status(404).json({
        status: "error",
        message: "Invalid user id",
        data: null,
      });
    }

    lensCreator.lensesCreated.push(newLens._id);

    await lensCreator.save();

    res.status(201).json({
      status: "success",
      data: newLens,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.getLens = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lens = await Lens.findById(id)
      .populate("markers")
      .populate("creator");


    if (!lens) {
      return res.status(404).json({
        status: "error",
        message: "Invalid lens id",
        data: null,
      });
    }

    lens.views++;

    await lens.save();

    lens.location.coordinates = lens.location.coordinates.reverse()
    lens.markers.forEach((marker) => marker.location.coordinates = marker.location.coordinates.reverse())

    res.status(201).json({
      status: "success",
      data: lens,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.getLensCenterCoordinates = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lens = await Lens.findById(id);

    if (!lens) {
      return res.status(404).json({
        status: "error",
        message: "Invalid lens id",
        data: null,
      });
    }

    const { circleBounds, circleBoundRadius } = lens?.address;
    const location = lens?.location
    location.coordinates = location.coordinates.reverse()

    res.status(200).json({
      status: "success",
      data: {
        location,
        bounds: {
          circleBounds,
          circleBoundRadius,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.updateLens = async (req, res, next) => {
  try {
    const lensId = req.params.id;
    const updatedLensDetails = req.body;
    const updatedLens = await Lens.findByIdAndUpdate(
      lensId,
      updatedLensDetails,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedLens) {
      return res.status(404).json({
        status: "error",
        message: "Lens to update not found",
        data: null,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Lens updated successfully",
      data: updatedLens,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.getLenses = async (req, res, next) => {
  const {
    creatorId,
    country,
    state,
    distance,
    sort,
    search,
    page = 1,
    limit = 10,
    clientLat,
    clientLng
  } = req.query;

  let sortStage = {};
  let matchStage = {};

  if (sort === "latest") {
    sortStage = { createdAt: -1 };
  } else if (sort === "oldest") {
    sortStage = { createdAt: 1 };
  } else if (sort === "popular") {
    sortStage = { views: -1, likes: -1, createdAt: -1 };
  } else {
    sortStage = { views: -1, likes: -1, createdAt: -1 };

  }

  if (creatorId) matchStage.creator = new mongoose.Types.ObjectId(creatorId);

  if (country) {
    matchStage["address.components.country"] = { $regex: new RegExp(country, "i") };
  }

  if (state) {
    matchStage["address.components.state"] = { $regex: new RegExp(state, "i") };
  }

  const searchConditions = [];

  if (search) {
    const regex = new RegExp(search, "i");

    searchConditions.push(
      { name: { $regex: regex } },
      { description: { $regex: regex } },
      { "address.formatted": { $regex: regex } },
      { tags: { $elemMatch: { $regex: regex } } }
    );
  }

  if (searchConditions.length > 0) {
    matchStage.$and = matchStage.$and || [];
    matchStage.$and.push({ $or: searchConditions });
  }

  const parsedDistance = parseInt(distance);
  const parsedClientLat = parseFloat(clientLat);
  const parsedClientLng = parseFloat(clientLng);

  try {
    const skip = (page - 1) * limit;

    let pipeline = [];

    if (parsedDistance && !isNaN(parsedDistance) && !isNaN(parsedClientLat) && !isNaN(parsedClientLng)) {

      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parsedClientLng, parsedClientLat]
          },

          distanceField: "distance",
          maxDistance: parsedDistance * 1000,
          spherical: true,
          query: matchStage
        }
      });
    } else {
      pipeline.push({ $match: matchStage });
    }


    pipeline = pipeline.concat([
      { $sort: sortStage },
      { $skip: skip },
      { $limit: parseInt(limit) },
      { $lookup: { from: 'markers', localField: 'markers', foreignField: '_id', as: 'markers' } },
      { $lookup: { from: 'users', localField: 'creator', foreignField: '_id', as: 'creator' } },
      { $unwind: '$creator' }
    ]);

    const lenses = await Lens.aggregate(pipeline).collation({ locale: "en", strength: 2 });

    const totalLenses = await Lens.countDocuments(matchStage);

    res.status(200).json({
      status: "success",
      message: "Lenses retrieved successfully",
      data: lenses,
      total: totalLenses,
      page,
      limit,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.deleteLens = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!lens) {
      return res.status(404).json({
        status: "error",
        message: "Invalid lens id",
        data: null,
      });
    }

    const deleteRecord = await Lens.deleteOne({ _id: id });

    if (!deleteRecord.deletedCount >= 1) {
      res.status(201).json({
        status: "success",
        message: "Lens deleted successfully",
        data: null,
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.addCommentToLens = async (req, res) => {
  const { id } = req.params;
  const { userId, body } = req.body;

  try {
    const lens = await Lens.findById(id);
    if (!lens) {
      return res.status(404).json({
        status: "error",
        message: "Lens not found",
        data: null,
      });
    }

    const newComment = await Comment.create({ userId, body });

    lens.comments.push(newComment._id);
    await lens.save();
    const populatedComment = await Comment.findById(newComment._id).populate(
      "userId"
    );

    res.status(201).json({
      status: "success",
      message: "Comment added successfully",
      data: populatedComment,
    });
  } catch (error) {

    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.deleteCommentFromLens = async (req, res) => {
  const { id, commentId } = req.params;
  try {
    const lens = await Lens.findById(id);
    if (!lens) {
      return res.status(404).json({
        status: "error",
        message: "Lens not found",
        data: null,
      });
    }

    lens.comments = lens.comments.filter(
      (comment) => comment.toString() !== commentId
    );
    await lens.save();

    await Comment.findByIdAndDelete(commentId);

    res.status(200).json({
      status: "success",
      message: "Comment deleted successfully",
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};

exports.getCommentsForLens = async (req, res) => {
  const { id } = req.params;
  const { sort, page = 1, limit = 10 } = req.query;

  let sortStage = {};
  let skip = (parseInt(page) - 1) * parseInt(limit);
  let limitStage = parseInt(limit);

  if (sort === "latest") {
    sortStage = { createdAt: -1 };
  } else if (sort === "oldest") {
    sortStage = { createdAt: 1 };
  }

  try {
    const lens = await Lens.findById(id);
    if (!lens) {
      return res.status(404).json({
        status: "error",
        message: "Lens not found",
        data: null,
      });
    }

    const totalComments = await Comment.countDocuments({
      _id: { $in: lens.comments },
    });

    const comments = await Comment.find({ _id: { $in: lens.comments } })
      .populate("userId")
      .sort(sortStage)
      .skip(skip)
      .limit(limitStage);

    res.status(200).json({
      status: "success",
      data: comments,
      total: totalComments,
      page: parseInt(page),
      limit: limitStage,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      data: null,
    });
  }
};
