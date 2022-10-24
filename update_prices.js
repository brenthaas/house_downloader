import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import { Client } from "@notionhq/client";
import moment from "moment";

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
      and: [
        {
          property: "Sold Price",
          number: {
            is_empty: true,
          }
        }, {
          property: "Created At",
          date: {
            before: moment().subtract(2, "weeks").format("YYYY-MM-DD")
          }
        }
      ]
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
  if(lastSaleString.match(salePriceRegex) == null) {
    return ['$0', 'Dec 31, 1999.']
  }
  let groups = lastSaleString.match(salePriceRegex).groups;
  return [groups.price, groups.saleDate];
}

const getSalePrice = async (url) => {
  console.log("Fetching ", url, " ......");
  const pageContent = await fetchPage(url);
  return parseSalePrice(pageContent);
}

const updatePriceInNotion = async (pageId, salePrice, saleDate) => {
  const response = await notion.pages.update({
    page_id: pageId,
    properties: {
      "Sold Price": {
        number: salePrice,
      },
       "Sold Date": {
        date: {
          start: saleDate
        }
      },
    },
  });
}


// ~~~~~~~~~~~~~ Main Script ~~~~~~~~~~~~~
const notion = new Client({ auth: process.env.NOTION_API_KEY });
let houses = await getHousesWithoutPrices();

houses.forEach( async (house) => {
  const url = house.properties['URL'].url;
  const title = house.properties.Description.title[0].plain_text
  const [price, date] = await getSalePrice(url);
  const parsedDate = moment(date, "MMM D, YYYY.", true);
  if(moment().diff(parsedDate, 'months') < 24) {
    console.log(`${title} sold on ${parsedDate.format('MMMM DD YYYY')} for ${price}`);
    updatePriceInNotion(
      house.id,
      parseInt(price.replaceAll(/[$, ]/gi, "")),
      parsedDate.format('YYYY-MM-DD')
    );
  } else {
    console.log(`${title} last sold on ${parsedDate.format('MMMM DD YYYY')}... not updating`)
  }
})

