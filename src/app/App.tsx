import * as React from "react";
import { useEffect, useState } from "react";
import usePortal from "react-useportal";
import {
  Button,
  Paper,
  CircularProgress,
  Checkbox,
  TextField,
} from "@material-ui/core";
import * as firebase from "firebase";

import {
  resizeResults,
  nets,
  detectSingleFace,
  loadFaceLandmarkModel,
  draw,
  TinyFaceDetectorOptions,
  matchDimensions,
} from "face-api.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBzLog0K1qhvhUfXOmPbADMcoL5NMsvEMk",
  authDomain: "culater-2020.firebaseapp.com",
  databaseURL: "https://culater-2020.firebaseio.com",
  projectId: "culater-2020",
  storageBucket: "culater-2020.appspot.com",
  messagingSenderId: "546913264532",
  appId: "1:546913264532:web:44621cbdbda94ae8f2a581",
  measurementId: "G-LS9YFL9ZMN",
};

firebase.initializeApp(firebaseConfig);
const storate = firebase.storage();

const App = () => {
  const [imageIds, setImageIds] = useState([]);
  const [ready, setReady] = useState(false);
  const [checkItems, setCheckedItems] = useState({});
  const [user, setUser] = useState("");
  const [saved, setSaved] = useState(false);

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
          newCanvas.style.position = "absolute";
          newCanvas.style.top = "0px";

          let newDiv = document.createElement("div");

          newCanvas.setAttribute("id", `canvas-${imageId}`);
          newDiv.setAttribute("id", imageId);
          newDiv.style.position = "absolute";
          newDiv.style.top = "0px";

          image.setAttribute("id", `src-${imageId}`);
          image.setAttribute("crossorigin", "anonymous");
          image.parentNode.parentNode.parentNode.parentNode.appendChild(
            newCanvas
          );
          image.parentNode.parentNode.parentNode.parentNode.appendChild(newDiv);
          newImagesIds.push(imageId);

          image.setAttribute("data-culater", "used");
          newCanvas.setAttribute("data-culater", "used");
          newDiv.setAttribute("data-culater", "used");
        });
        setImageIds(newImagesIds);
        setCheckedItems({});
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
      <br />
      <Button
        disabled={!user}
        onClick={async () => {
          let imageIds = Object.keys(checkItems).filter(
            (key) => !!checkItems[key]
          );
          await uploadImages(imageIds, user);
          setSaved(true);
          setTimeout(() => {
            setSaved(false);
          }, 3000);
        }}
        variant="contained"
        color="primary"
      >
        {saved ? "Saved!" : "Save images to DB"}
      </Button>
      <br />
      <TextField
        value={user}
        onChange={(e) => setUser(e.target.value)}
        placeholder="User Name"
      />
      {imageIds.map((imageId) => (
        <ImageAddon
          key={imageId}
          imageId={imageId}
          ready={ready}
          onCheckClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            let newCheckItems = { ...checkItems };
            newCheckItems[imageId] = !checkItems[imageId];
            setCheckedItems(newCheckItems);
          }}
          checked={!!checkItems[imageId]}
        />
      ))}
    </Paper>
  );
};

export default App;

const ImageAddon = ({ imageId, ready, checked, onCheckClick }) => {
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
      {!loading && (
        <Checkbox
          style={{ position: "absolute" }}
          checked={checked}
          onClick={onCheckClick}
        />
      )}
    </Portal>
  );
};

const uploadImages = async (imageIds, user) => {
  for await (const imageId of imageIds) {
    let imageElement = document.getElementById(
      `src-${imageId}`
    ) as HTMLImageElement;
    await fetch(imageElement.src)
      .then((res) => res.blob())
      .then((blob) => {
        let imageName = `images/image_${new Date().getTime()}.jpg`;
        let storageRef = storate.ref(imageName);
        storageRef.put(blob).then(function () {
          let dbRef = firebase.database().ref(`/users/${user}/images`);
          dbRef.push({
            url: imageName,
            timestamp: new Date().getTime(),
          });
        });
      });
  }
};
