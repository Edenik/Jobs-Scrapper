const cheerio = require('cheerio')
const axios = require('axios');
const writeFile = require('./writeFile');

const logs = [];

const log = (string) => {
    console.log(string);
    logs.push(string + '\n');
}

const main = async () => {
    const careers_data = {};
    const careers = await getCareers();
    log('Total careers (links) - ' + careers.length);
    log(`Careers: ${careers.map((career) => career.text).join(', ')}\n\n`);
    let total_pages = 1;
    let total_results = 0;

    for (const career of careers) {
        log(`[ ${career.text} ] - Getting data`);

        const careerStart = Date.now();
        const { data, pages, results } = await getCareerData(encodeURI(career.href));
        const careerEnd = Date.now();

        log(`[ ${career.text} ] - WEB Pages: ${pages}, Jobs: ${results}`);
        log(`[ ${career.text} ] - Execution time: ${(careerEnd - careerStart) / 1000} seconds \n`);

        careers_data[career.text] = data;
        total_pages += pages;
        total_results += results
    }

    writeFile('careers.json' ,JSON.stringify(careers_data));
    log(`\n\nI've been scanned: \nCareers: ${careers.length}, WEB Pages: ${total_pages + careers.length}, Jobs: ${total_results}\n`);
}

const getCareers = async () => await getLinksFromURL('https://www.sqlink.com/career', '#searchJobsMenu');

const getLinksFromURL = async (url, selector = '') => {
    try {
        log('Getting links from url - ' + url)
        const links = [];
        const httpResponse = await axios.get(url);

        const $ = cheerio.load(httpResponse.data);
        const linkObjects = $(`${selector} a`); // get all hyperlinks

        linkObjects.each((index, element) => {
            links.push({
                text: cleanText($(element).text()), // get the text
                href: $(element).attr('href'), // get the href attribute
            });
        });

        return links;
    } catch (e) {
        log(e)
    }
}

const getCareerData = async (url) => {
    try {
        const { total_results, childs_per_page, $ } = await getCareerInfo(url);
        const total_pages = Math.ceil(total_results / childs_per_page) - 1;
        const requests = [];

        for (let index = 0; index < total_pages; index++) {
            requests.push(axios.get(url + `?page=${index + 2}`));
        }

        const responses = await Promise.all(requests);
        const cheerio_data = [$, ...loadCheerioData(responses)];
        const data = mapData(cheerio_data);

        return { results: total_results, pages: total_pages + 1, data };
    } catch (error) {
        log({ error })
    }
}

const getCareerInfo = async (url) => {
    try {
        const response = await axios.get(url + '?page=1');
        const $ = cheerio.load(response.data);
        const total_results = $('#resultsDetails')[0].children[0].children[0].next.children[0].data.trim();
        const childs_per_page = $('.positionItem').length;

        return { total_results: Number(total_results), childs_per_page, $ };
    } catch (error) {
        log({ error });
    }

}

const mapData = (responses) => {
    const collector = [];

    for (const $ of responses) {
        try {
            $('.positionArticle').each((index, element) => {
                const position_data = [];

                for (let child of element.children) {
                    const data = cleanText($(child).text());
                    data !== '' && position_data.push(data);
                }

                collector.push(position_data);
            })
        } catch (error) {
            log(error);
        }
    }

    return collector
}

const init = async () => {
    const start = Date.now();
    await main();
    const end = Date.now();
    log(`Execution time: ${(end - start) / 1000} seconds`);
    writeFile('logs.txt', logs.join(' '));
}

init();

/* Helpers */
const loadCheerioData = (responses) => responses.map((response) => cheerio.load(response.data));
const cleanText = (string) => string.replace(/(\r\n|\n|\r)/gm, "").trim();
