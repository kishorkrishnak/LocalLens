const Lens = require("../models/Lens");
const User = require("../models/User");
const Comment = require("../models/Comment");

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

    res.status(200).json({
      status: "success",
      data: {
        location: lens?.location,
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
    sort,
    filter,
    search,
    page = 1,
    limit = 10,
    clientGeoCoordinates,
  } = req.query;

  let sortStage = {};
  let matchStage = {};

  if (sort === "latest") {
    sortStage = { createdAt: -1 };
  } else if (sort === "oldest") {
    sortStage = { createdAt: 1 };
  } else if (sort === "popular") {
    sortStage = { views: -1, likes: -1, createdAt: -1 };
  }

  if (country) matchStage.country = country;
  if (state) matchStage.state = state;
  if (creatorId) matchStage.creator = creatorId;

  const searchConditions = [];
  if (search) {
    const regex = new RegExp(search, "i");
    searchConditions.push(
      { name: { $regex: regex } },
      { description: { $regex: regex } },
      // { state: { $regex: regex } },  // Uncomment if needed
      // { district: { $regex: regex } },  // Uncomment if needed
      { tags: { $elemMatch: { $regex: regex } } }
    );
  }

  if (searchConditions.length > 0) {
    matchStage.$and = matchStage.$and || [];
    matchStage.$and.push({ $or: searchConditions });
  }

  const collation = { locale: "en", strength: 2 };

  try {
    const skip = (page - 1) * limit;

    const lenses = await Lens.find(matchStage)
      .collation(collation)
      .sort(sortStage)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("markers")
      .populate("creator");

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
    console.log(error);
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
