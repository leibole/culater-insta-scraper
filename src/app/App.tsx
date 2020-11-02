import * as React from "react";
import { useEffect, useState } from "react";
import usePortal from "react-useportal";
import {
  Button,
  Paper,
  CircularProgress,
  Checkbox,
  TextField,
  Chip,
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
          newCanvas.setAttribute("id", `canvas-${imageId}`);

          let newDiv = document.createElement("div");
          newDiv.setAttribute("id", imageId);
          newDiv.style.position = "absolute";
          newDiv.style.top = "0px";

          let newCheckDiv = document.createElement("div");
          newCheckDiv.setAttribute("id", `check-${imageId}`);
          newCheckDiv.style.position = "absolute";
          newCheckDiv.style.top = "0px";

          image.setAttribute("id", `src-${imageId}`);
          image.setAttribute("crossorigin", "anonymous");
          image.parentNode.appendChild(newCanvas);
          image.parentNode.appendChild(newDiv);
          image.parentNode.parentNode.parentNode.parentNode.appendChild(
            newCheckDiv
          );
          newImagesIds.push(imageId);

          image.setAttribute("data-culater", "used");
          newCanvas.setAttribute("data-culater", "used");
          newDiv.setAttribute("data-culater", "used");
          newCheckDiv.setAttribute("data-culater", "used");
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
      <h3>CULA actions:</h3>
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
      {imageIds.map((imageId) => (
        <ImageCheck
          key={imageId}
          imageId={imageId}
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

const ImageCheck = ({ imageId, checked, onCheckClick }) => {
  const { Portal } = usePortal({
    bindTo: document && document.getElementById(`check-${imageId}`),
  });

  const imageElement = document.getElementById(`src-${imageId}`);
  const imageDate = getImageDate(imageElement);

  return (
    <Portal>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <Checkbox
          style={{ width: 30 }}
          checked={checked}
          onClick={onCheckClick}
        />
        {!imageDate && <Chip style={{ margin: 5 }} label="No image date :/" />}
      </div>
    </Portal>
  );
};

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
            timestamp:
              getImageDate(imageElement)?.getTime() || new Date().getTime(),
          });
        });
      });
  }
};

const getImageDate = (imageElement) => {
  let altText = imageElement?.alt;
  let match = altText?.match(/on (.* \d*, \d{4})/);
  if (match && match[1]) {
    return new Date(match[1]);
  }

  let timeElement = Array.from(document.querySelectorAll("time"))
    .map((node) => node.parentElement)
    .find((a: HTMLLinkElement) => a && a.href && !a.href.includes("/c/"))
    ?.querySelector("time")
    ?.getAttribute("datetime");

  return timeElement && new Date(timeElement);
};
