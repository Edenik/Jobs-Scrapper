const cheerio = require('cheerio')
const axios = require('axios')

const main = async () => {
    let total_pages = 0;
    let total_results = 0;
    const careers_data = {};
    const careers = await getCareers();

    for (let career of careers) {
        console.log(`[ ${career.text} ] - Getting data`)
        const careerStart = Date.now();

        const { data, pages, results } = await getCareerData(encodeURI(career.href));
        const careerEnd = Date.now();
        console.log(`[ ${career.text} - WEB Pages: ${pages}, Jobs: ${results}`)
        console.log(`[ ${career.text} ] - Execution time: ${(careerEnd - careerStart) / 1000} seconds \n`);

        careers_data[career.text] = data;
        total_pages += pages;
        total_results += results
    }

    writeFile(JSON.stringify(careers_data))
    console.log(`\n\nI've been scanned: \nCareers: ${careers.length}, WEB Pages: ${total_pages + careers.length + 1}, Jobs: ${total_results}\n`);
}

const getCareers = async () => {
    return await getLinksFromURL('https://www.sqlink.com/career', '#searchJobsMenu');
}

const getLinksFromURL = async (url, selector = '') => {
    try {
        let links = [];
        let httpResponse = await axios.get(url);

        let $ = cheerio.load(httpResponse.data);
        let linkObjects = $(`${selector} a`); // get all hyperlinks

        linkObjects.each((index, element) => {
            links.push({
                text: cleanText($(element).text()), // get the text
                href: $(element).attr('href'), // get the href attribute
            });
        });

        return links;
    } catch (e) { console.log(e) }

}

const getCareerData = async (url) => {
    try {
        const { total_results, childs_per_page, $ } = await getFirstPageData(url);

        const total_pages = Math.ceil(total_results / childs_per_page) - 1;

        const requests = [];

        for (let index = 0; index < total_pages; index++) {
            requests.push(axios.get(url + `?page=${index + 2}`));
        }

        const responses = await Promise.all(requests);

        const cheerio_data = [$, ...loadCheerioData(responses)];
        const data = mapData(cheerio_data);

        return { results: total_results, pages: total_pages, data };
    } catch (error) {
        console.log({ error })
    }
}

const getFirstPageData = async (url) => {
    try {
        const response = await axios.get(url + '?page=1');
        const $ = cheerio.load(response.data);
        const total_results = $('#resultsDetails')[0].children[0].children[0].next.children[0].data.trim();
        const childs_per_page = $('.positionItem').length;

        return { total_results: Number(total_results), childs_per_page, $ };
    } catch (error) {
        console.log({ error });
    }

}

const mapData = (responses) => {
    const collector = [];

    for ($ of responses) {
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
            console.log(error);
        }
    }

    return collector
}

const init = async () => {
    const start = Date.now();
    await main();
    const end = Date.now();
    console.log(`Execution time: ${(end - start) / 1000} seconds`);
}

init();

/* Helpers */

const loadCheerioData = (responses) => responses.map((response) => cheerio.load(response.data));

const cleanText = (string) => string.replace(/(\r\n|\n|\r)/gm, "").trim();

const writeFile = (content) => {
    const fs = require('fs')

    fs.writeFile('careers.json', content, (err) => {
        if (err) {
            console.error(err)
            return;
        }
    })
}
