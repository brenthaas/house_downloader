import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import readlineSync from "readline-sync";
import { Client } from "@notionhq/client";

const fetchPage = (url) =>
  fetch(url)
    .then((response) => response.text())
    .then((data) => (new JSDOM(data).window.document))
    .catch((err) => console.log("Failed to download", err));

const getHousesWithoutPrices = async () => {
  const databaseId = process.env.NOTION_HOUSE_DATABASE_ID;
  const query = {
    database_id: databaseId,
    filter: {
      property: "Sold Price",
      number: {
        is_empty: true,
      },
    },
    sorts: [
      {
        property: "Created At",
        direction: "ascending",
      },
    ],
  };

  try {
    const response = await notion.databases.query(query);
    return response.results
  } catch (error) {
    console.error("Error received fetching houses!");
    console.error("error: ", error);
    console.error("body: ", error.body);
  }
}

const parseSalePrice = (document) => {
  const lastSaleString = document.querySelector("div.secondary-info").textContent;
  let salePriceRegex =
    /This home last sold for (?<price>\$[,\d]+) on (?<saleDate>.*)$/;
  let groups = lastSaleString.match(salePriceRegex).groups
  return [groups.price, groups.saleDate]
}

const getSalePrice = async (url) => {
  console.log("Fetching ", url, " ......")
  const pageContent = await fetchPage(url);
  return parseSalePrice(pageContent)
}


const notion = new Client({ auth: process.env.NOTION_API_KEY });
let houses = await getHousesWithoutPrices()
let houseUrls = houses.map( (result) => (result.properties['URL'].url));

const [price, date] = await getSalePrice(houseUrls[0]);

console.log("Got Sale Price: ", price, " on date ", date);
