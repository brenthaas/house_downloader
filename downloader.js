import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import readlineSync from "readline-sync";
import { Client } from "@notionhq/client";

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

  // Get Address
  houseInfo["address"] = (
    document.querySelector("[data-rf-test-id='abp-streetLine']").innerHTML +
    " " +
    document.querySelector("[data-rf-test-id='abp-cityStateZip']").innerHTML
  ).replaceAll(/<!-- -->/g, "");

  // Get Price and Beds info
  document.querySelectorAll("[data-rf-test-id='abp-beds']").forEach((elem) => {
    const children = elem.childNodes;
    let title = children[1].innerHTML.toLowerCase();
    if (title !== "price" && title !== "beds") {
      title = "price";
    }
    houseInfo[title] = children[0].innerHTML;
  });

  // Get Baths
  houseInfo["baths"] = document.querySelectorAll(
    "[data-rf-test-id='abp-baths']"
  )[0].childNodes[0].innerHTML;

  // get SqFt
  houseInfo["sqft"] = document.querySelectorAll(
    "[data-rf-test-id='abp-sqFt']"
  )[0].childNodes[0].innerHTML;

  // get lot Size
  houseInfo["lot"] =
    document.querySelectorAll("div.keyDetail")[5].childNodes[1].innerHTML;

  // Get Baths
  houseInfo["description"] = document.querySelector(
    "[data-rf-test-id='listingRemarks'] p span"
  ).innerHTML;

  houseInfo["misc"] = [];
  document
    .querySelectorAll("div.amenities-container ul li")
    .forEach(
      (node) => (houseInfo["misc"] = [node.textContent, ...houseInfo["misc"]])
    );

  return houseInfo;
};

const getImageBlocks = (imageUrls) => {
  return imageUrls.map((url) => ({
    object: "block",
    type: "image",
    image: {
      type: "external",
      external: {
        url: url,
      },
    },
  }));
};

const addInfoToNotion = async (info, imageUrls) => {
  const title = readlineSync.question("What Title? ");

  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      cover: {
        type: "external",
        external: {
          url: imageUrls[0],
        },
      },
      properties: {
        Description: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
        URL: { id: "BsOe", type: "url", url: info.url },
        "For Sale Price": {
          id: "%5CAmm",
          type: "number",
          number: parseInt(info.price.replace("$", "").replaceAll(",", "")),
        },
        Location: {
          id: "AeoI",
          type: "rich_text",
          rich_text: [{ type: "text", text: { content: info.address } }],
        },
        Baths: {
          id: "PhUe",
          type: "number",
          number: info.baths && parseFloat(info.baths),
        },
        Beds: {
          id: "%5El%5ED",
          type: "number",
          number: info.beds && parseInt(info.beds),
        },
        "sq.ft.": {
          id: "%3A%5BCH",
          type: "number",
          number: parseInt(info.sqft.replace(",", "")),
        },
        "Lot Size": {
          id: "IK%40%3B",
          type: "number",
          number: parseInt(info.lot.replace(",", "")),
        },
      },
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            text: [
              {
                type: "text",
                text: {
                  content: "Description",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            text: [
              {
                type: "text",
                text: {
                  content: info.description,
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            text: [
              {
                type: "text",
                text: {
                  content: "details",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "code",
          code: {
            text: [
              {
                type: "text",
                text: {
                  content: JSON.stringify(info.misc, null, 2),
                },
              },
            ],
            language: "json",
          },
        },
        {
          object: "block",
          type: "toggle",
          toggle: {
            text: [
              {
                type: "text",
                text: {
                  content: "Photos",
                },
              },
            ],
            children: getImageBlocks(imageUrls),
          },
        },
      ],
    });
    console.log(response);
    console.log("Success! Entry added.");
  } catch (error) {
    console.error("Error received!");
    console.error("error: ", error);
    console.error("body: ", error.body);
  }
};

let homeUrl = process.argv[2];

if (!homeUrl) {
  homeUrl = readlineSync.question("What URL? ");
}

const shortName = getShortName(homeUrl);

const pageContent = await fetchPage(homeUrl);
const houseImageUrls = parseImageUrls(pageContent);
const dom = new JSDOM(pageContent);
const houseInfo = { url: homeUrl, ...parseHouseInfo(dom.window.document) };

///////// Done with info gathering,

if (process.env.NOTION_KEY === undefined) {
  console.log("no Notion key set");
  process.exit(1);
}
if (process.env.NOTION_DATABASE_ID === undefined) {
  console.log("no Notion database set");
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

console.log("House Info: ", houseInfo);
addInfoToNotion(houseInfo, houseImageUrls);
