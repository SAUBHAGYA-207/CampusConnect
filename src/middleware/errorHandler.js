module.exports = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Something went wrong on the server.',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
};
