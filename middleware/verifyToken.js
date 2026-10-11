const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(authHeader){
        const token = authHeader.split(" ")[1];

        jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
            if(err){
                return res.status(403).json({status: false, message: "Invalid token"});
            }
            req.user = user;
            next();
        })
    }
    else{
        res.status(401).json({status: false, message: "You are not authenticated"});
    }
}

const verifyTokenAndAuthorization = (req, res, next) => {
    verifyToken(req, res, ()=>{
        
        if(req.user.userType ==='User' || req.user.userType ==='Admin'){
            next();
        }
        else{
            res.status(403).json({status: false, message: "You are not allowed"});
        }
    })
}

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, ()=>{
        
        if(req.user.userType ==='Admin'){
            next();
        }
        else{
            res.status(403).json({status: false, message: "You are not allowed"});
        }
    })
}

module.exports = {verifyAdmin, verifyTokenAndAuthorization};