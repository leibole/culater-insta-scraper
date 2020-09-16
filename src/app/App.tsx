import * as React from "react";
import { useEffect, useState } from "react";
import usePortal from "react-useportal";
import { Button, Paper, CircularProgress } from "@material-ui/core";

import {
  resizeResults,
  nets,
  detectSingleFace,
  loadFaceLandmarkModel,
  draw,
  TinyFaceDetectorOptions,
  matchDimensions,
  TNetInput,
} from "face-api.js";

const App = () => {
  const [imageIds, setImageIds] = useState([]);
  const [ready, setReady] = useState(false);

  const injectIntoImages = async () => {
    const article = document.querySelectorAll("article")[0];
    if (article) {
      let images = article.querySelectorAll("img");
      console.log(images);

      let newImagesIds = [];
      let existingImages = document.querySelectorAll("img[data-culater]");
      existingImages.forEach((existingImage) =>
        existingImage.setAttribute("id", "")
      );

      let existingCanvases = document.querySelectorAll("canvas[data-culater]");
      existingCanvases.forEach((existingCanvas) => existingCanvas.remove());
      let existingDivs = document.querySelectorAll("div[data-culater]");
      existingDivs.forEach((existingDiv) => existingDiv.remove());

      setImageIds([]);

      setTimeout(() => {
        images.forEach((image, idx) => {
          const imageId = `image-${idx}`;
          let newCanvas = document.createElement("canvas");
          // newCanvas.style.height = `${image.naturalHeight}px`;
          // newCanvas.style.width = `${image.naturalWidth}px`;
          newCanvas.style.position = "absolute";

          let newDiv = document.createElement("div");

          newCanvas.setAttribute("id", `canvas-${imageId}`);
          newDiv.setAttribute("id", imageId);
          image.setAttribute("id", `src-${imageId}`);
          image.setAttribute("crossorigin", "anonymous");
          image.parentNode.appendChild(newCanvas);
          image.parentNode.appendChild(newDiv);
          newImagesIds.push(imageId);

          image.setAttribute("data-culater", "used");
          newCanvas.setAttribute("data-culater", "used");
          newDiv.setAttribute("data-culater", "used");
        });
        setImageIds(newImagesIds);
      }, 100);

      await loadFaceLandmarkModel(chrome.runtime.getURL("/models"));
      await nets.tinyFaceDetector.load(chrome.runtime.getURL("/models"));
      setReady(true);
    } else {
      setTimeout(injectIntoImages, 1000);
    }
  };

  useEffect(() => {
    injectIntoImages();
  }, []);

  return (
    <Paper style={{ margin: 15, position: "fixed", top: 0, padding: 15 }}>
      <h3>Culater actions:</h3>
      <br />
      <Button onClick={injectIntoImages} variant="contained" color="primary">
        Find faces
      </Button>
      {imageIds.map((imageId) => (
        <ImageAddon key={imageId} imageId={imageId} ready={ready} />
      ))}
    </Paper>
  );
};

export default App;

const ImageAddon = ({ imageId, ready }) => {
  let [loading, setLoading] = useState(true);
  const { Portal } = usePortal({
    bindTo: document && document.getElementById(imageId),
  });

  useEffect(() => {
    const detectFace = async () => {
      if (ready) {
        try {
          const input = document.getElementById(`src-${imageId}`);

          const options = new TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          });

          const result = await detectSingleFace(
            input as HTMLImageElement,
            options
          ).withFaceLandmarks();

          if (result) {
            console.log(result);
            const canvas = document.getElementById(`canvas-${imageId}`);
            const dims = matchDimensions(
              canvas as HTMLCanvasElement,
              input as HTMLImageElement,
              true
            );
            const resizedResult = resizeResults(result, dims);

            draw.drawFaceLandmarks(canvas as HTMLCanvasElement, result);
          }
          setLoading(false);
        } catch (e) {
          console.error(e);
        }
      }
    };
    const imageElement = document.getElementById(imageId);
    if (imageElement) detectFace();
  }, [ready]);

  return (
    <Portal>
      {loading && <CircularProgress style={{ position: "absolute" }} />}
    </Portal>
  );
};
