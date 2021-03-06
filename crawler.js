'use strict';
const request = require('request');
const cheerio = require('cheerio');
const URL = require('url-parse');
const Deque = require('double-ended-queue');

const SEED_URL = process.argv[2];
const visited = new Set();
const url_queue = new Deque([SEED_URL]);
// This is used to track whether we have unterminated requests
let current_requests = 0;
// Constants that affect performance
const CHECK_QUEUE_INTERVAL = 50;

crawl();

function crawl() {
  while (!url_queue.isEmpty()) {
    const next_url = url_queue.shift();
    if (visited.has(next_url)) {
      // We've already seen this URL
      continue;
    }
    visit_page(next_url);
  }
  wait_for_links(CHECK_QUEUE_INTERVAL);
}

function wait_for_links(interval) {
  console.log(url_queue.isEmpty(), current_requests);
  if (url_queue.isEmpty()) {
    if (current_requests) {
      setTimeout(wait_for_links.bind(null, interval), interval);
    }
    else {
      // Queue is empty and no more requests so we must be done
      return;
    }
  }
  else {
    // Queue is no longer empty so crawl those links
    crawl();
  }
}

function visit_page(url) {
  console.log("visiting", url);
  visited.add(url);
  current_requests++;
  const current_url_object = new URL(url);
  const base_url = current_url_object.protocol + "//" + current_url_object.hostname;
  const current_hostname = current_url_object.hostname;
  request({
    url,
    headers: {
      'User-Agent': "Emil's test-crawler for internship application coding challenge",
    },
  }, (err, res, body) => {
    // request returned so decrement current requests
    current_requests--;
    if (err) {
      return console.error("Error occured when requesting " + url + ": " + err);
    }
    if (res.statusCode !== 200) {
      return;
    }

    const $ = cheerio.load(body);
    const links = $('a');
    $(links).each((index, link) => {
      const url = new URL($(link).attr('href'));
      if (url.pathname.split("/")[1] === "cdn-cgi") {
        // It's a cloudflare virtual directory so ignore it
        return;
      }
      if (url.protocol && url.hostname !== current_hostname) {
        // Absolute URL for foreign site
        // For a small test I would recommend commenting out the following line so you
        // only check the seed domain
        url_queue.push(url.href);
      }
      else if (url.pathname) {
        // URL for our site, either it's relative or absolute with current host 
        // Use unshift to prioritize current domain first
        url_queue.unshift(base_url+url.pathname);
      }
      // Else it is garbage such as #
    });
  });
}

