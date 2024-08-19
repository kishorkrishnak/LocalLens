import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";

function useRoutingMachine(waypoints) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const lineOptions = {
      styles: [
        { color: "blue", opacity: 0.6, weight: 4 },
        {
          color: "white",
          opacity: 0.8,
          weight: 2,
          dashArray: "20,15",
          dashOffset: "0",
        },
        {
          color: "blue",
          opacity: 1,
          weight: 2,
          dashArray: "5,15",
          dashOffset: "5",
        },
      ],
    };

    const routingControl = L.Routing.control({
      waypoints,
      fitSelectedRoutes: false,

      //prevent map click creating markers
      createMarker: function () {
        return null;
      },
      addWaypoints: false,
      lineOptions,
    }).addTo(map);

    return () => map.removeControl(routingControl);
  }, [map, waypoints]);

  return null;
}

export default useRoutingMachine;
