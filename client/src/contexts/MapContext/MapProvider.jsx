import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createMarker, deleteMarker, updateMarker } from "../../api/marker";
import MapContext from "./MapContext";

export const MapProvider = ({ children }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [routingMode, setRoutingMode] = useState(false);
  const [centerLatLong, setCenterLatLong] = useState([1, 15]);
  const [lens, setLens] = useState(null);
  const maxBounds = [
    [12.74116988678989, 75.09318351745607],
    [12.797405423615684, 75.22253036499025],
  ];

  const [markerData, setMarkerData] = useState({
    lat: null,
    lng: null,
    title: "",
    description: "",
    category: "",
    image: "",
  });

  //get client's geocoordinates and set it as the default center of map
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setCenterLatLong([latitude, longitude]);
      }
    );
  }, []);

  async function addMarker() {
    if (!(markerData.title && markerData.category)) {
      return toast.error("You must provide a title and category");
    }

    const newMarker = {
      ...markerData,
      lensId: lens._id,
      location: {
        type: "Point",
        coordinates: [markerData.lat, markerData.lng],
      },
    };

    const response = await createMarker(newMarker);

    setLens({
      ...lens,
      markers: [...lens.markers, response.data.data],
    });

    setModalVisible(false);
    toast.success("Marker added");
    setMarkerData({});
  }

  async function removeMarker(id) {
    try {
      const response = await deleteMarker(id);
      if (response.data.status === "success") {
        const updatedMarkers = lens.markers.filter(
          (marker) => marker._id !== id
        );

        setLens({
          ...lens,
          markers: [...updatedMarkers],
        });

        toast.success("Marker deleted");
        setRoutingMode(false);
      } else {
        throw new Error();
      }
    } catch (error) {
      toast.success("Error while deleting marker");
    }
  }

  const updateMarkerPosition = async (id, { lat, lng }) => {
    try {
      const response = await updateMarker(id, {
        location: {
          type: "Point",
          coordinates: [lat, lng],
        },
      });
      if (response.data.status === "success") {
        const updatedMarkers = lens.markers.map((marker) => {
          if (marker._id === id) {
            return {
              ...marker,
              location: {
                type: "Point",
                coordinates: [lat, lng],
              },
            };
          }

          return marker;
        });

        setLens({
          ...lens,
          markers: updatedMarkers,
        });
      } else {
        throw new Error("Error while updating marker");
      }
    } catch (error) {
      toast.error("Could not update marker");
    }
  };

  const contextValue = {
    markers: lens?.markers,
    modalVisible,
    setModalVisible,
    markerData,
    setMarkerData,
    addMarker,
    removeMarker,
    updateMarkerPosition,
    centerLatLong,
    maxBounds,
    markerCount: lens?.markers?.length,
    routingMode,
    setRoutingMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    lens,
    setLens,
  };

  return (
    <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>
  );
};

export default MapProvider;
