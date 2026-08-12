const sendError = (res, error, status = 500) => {
    return res.status(status).send({
        success: false,
        message: error.message || "Internal Server Error",
    });
};

module.exports = sendError;