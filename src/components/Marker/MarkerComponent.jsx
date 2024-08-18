import { useMemo, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import { useMapContext } from "../../contexts/MapContext";
import "./MarkerComponent.css";
import { Button } from "@mui/material";

const MarkerComponent = ({ marker }) => {
  const position = [marker.lat, marker.lng];
  const { updateMarkerPosition, deleteMarker } = useMapContext();
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const markerElement = markerRef.current;

        if (markerElement != null) {
          updateMarkerPosition(marker.id, markerElement.getLatLng());
        }
      },
    }),
    []
  );
  const markerRef = useRef(null);
  return (
    <Marker
      eventHandlers={eventHandlers}
      ref={markerRef}
      draggable
      position={position}
    >
      <Popup>
        <h3 className="marker-title">{marker.title}</h3>
        <p className="marker-description">{marker.description}</p>
        <p className="marker-category">
          <span>Category:</span> {marker.category}
        </p>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            deleteMarker(marker.id);
          }}
          variant="contained"
          color="error"
        >
          Delete
        </Button>
        ;
      </Popup>
    </Marker>
  );
};

export default MarkerComponent;
