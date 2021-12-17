import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import fs from "fs";
import os from "os";

const downloadImage = (url, dirpath) => {
  const imageName = url.split("/")[7];
  const filename = [dirpath, imageName].join("/");

  if (!fs.existsSync(filename)) {
    fetch(url)
      .then((response) => {
        return response.body;
      })
      .then((body) => {
        console.log(`Downloaded ${filename}`);
        body.pipe(fs.createWriteStream(filename));
      })
      .catch((err) => console.log("Failed to download image - ", err));
  } else {
    console.log(`File already exists - ${filename}`);
  }
};

const fetchPage = (url) =>
  fetch(url)
    .then((response) => response.text())
    .then((data) => data)
    .catch((err) => console.log("Failed to download", err));

function parseImageUrls(page) {
  const imageRegex =
    /https:\\u002F\\u002Fssl\.cdn-redfin\.com\\u002Fphoto\\u002F10\\u002Fbigphoto\\u002F[\d]+\\u002F[\d_]+.jpg/g;
  const foundImages = [...page.matchAll(imageRegex)];
  const imageUrls = Array.from(
    new Set(
      foundImages.map((image) =>
        decodeURIComponent(JSON.parse(`"${image[0]}"`))
      )
    )
  );
  return imageUrls;
}

const getShortName = (url) => {
  const components = url.split("/");
  return components[5] + "-" + components[4];
};

const parseHouseInfo = (document) => {
  let houseInfo = {};
  // Get Price and Beds info
  document.querySelectorAll("[data-rf-test-id='abp-beds']").forEach((elem) => {
    const children = elem.childNodes;
    houseInfo[children[1].innerHTML.toLowerCase()] = children[0].innerHTML;
  });

  // Get Baths
  houseInfo["baths"] = document.querySelectorAll(
    "[data-rf-test-id='abp-baths']"
  )[0].childNodes[0].innerHTML;

  // get SqFt
  houseInfo["sqft"] = document.querySelectorAll(
    "[data-rf-test-id='abp-sqFt']"
  )[0].childNodes[0].innerHTML;

  houseInfo["misc"] = [];
  document
    .querySelectorAll("div.amenities-container ul li")
    .forEach(
      (node) => (houseInfo["misc"] = [node.textContent, ...houseInfo["misc"]])
    );

  return houseInfo;
};

const homeUrl = process.argv[2];

const shortName = getShortName(homeUrl);
const baseDirectory = `${os.homedir()}/Pictures/houses`;
const directoryName = [baseDirectory, shortName].join("/");
if (!fs.existsSync(directoryName)) {
  fs.mkdirSync(directoryName);
}

const pageContent = await fetchPage(homeUrl);
const houseImageUrls = parseImageUrls(pageContent);

houseImageUrls.map((url) => {
  downloadImage(url, directoryName);
});

const dom = new JSDOM(pageContent);

const houseInfo = { url: homeUrl, ...parseHouseInfo(dom.window.document) };
const infoFile = `${directoryName}/info.json`;

if (!fs.existsSync(infoFile)) {
  console.log("Writing house info...");
  fs.writeFileSync(infoFile, JSON.stringify(houseInfo, null, 2), "utf-8");
} else {
  console.log(`${infoFile} already present`);
}
