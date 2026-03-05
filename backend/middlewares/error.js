import {logError} from "../utilities/vtu.js"
import {log} from "./logger.js";

export default async (req, res, next) => {
  if (req.path.includes("/api/")) {
    if (req.err && !req.message) {
      if (req.err instanceof req.AppError) {
        req.message = req.err.message
      } else {
        req.message = "something went wrong internally try again, if issues persist please report!";
        await logError("INTERNAL_SERVER_ERROR", req.err, req.body)
      }
    }
    
    const message = req.message || 'Api route not found';
    res.status(404).json({
      message,
      success: false
    })
    if (req.err) log(req.err, "bad")
  } else {
    res.redirect("/404.html")
  }
}