import { lazy } from "react";
import { Toaster } from "react-hot-toast";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import { MapProvider } from "./contexts/MapContext";
const LazyHome = lazy(() => import("./pages/Home"));

const App = () => {
  return (
    <MapProvider>
      <BrowserRouter>
        <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} />
        <Routes>
          <Route path="/" element={<LazyHome />} />
        </Routes>
      </BrowserRouter>
    </MapProvider>
  );
};

export default App;
