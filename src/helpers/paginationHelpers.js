function getPaginatedResponse(page, pages, count, perPage, items) {
    return {
        page: page,
        pages: pages,
        itemsCount: count,
        perPage: perPage,
        items: items
    }
}

function getCurrentPage(req, pages) {
    let page = parseInt(req.query.page) || 1
    // sanitize page input
    page = page < 1 ? 1 : page
    page = page > pages ? pages : page
    return page
}

function getNumOfPages(itemsCount, perPage) {
    let pages = Math.ceil(itemsCount / perPage)
    return pages > 0 ? pages : 1
}

module.exports = {
    getPaginatedResponse,
    getCurrentPage,
    getNumOfPages
}