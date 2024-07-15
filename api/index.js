const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const cors = require("cors");
require("dotenv").config({ path: ".env" });

const app = express();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
const connectToMongo = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGOOSE_URI}`
    );
    console.log(
      `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("MONGODB connection FAILED ", error);
    process.exit(1);
  }
};

// Multer configuration
const upload = multer({ dest: "uploads/" });

// Mongoose Schema and Model
const { Schema } = mongoose;

const addDataSchema = new Schema(
  {
    prodNo: {
      type: Number,
      required: true,
      default: 1,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    ingredients: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    prodImg1: {
      type: String,
      required: true,
    },
    prodImg2: {
      type: String,
    },
    prodImg3: {
      type: String,
    },
    prodImg4: {
      type: String,
    },
    prodVideo: {
      type: String,
    },
    prodCost: {
      type: String,
      required: true,
    },
    prodServer: {
      type: String,
      required: true,
    },
    prodDescription: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now(),
    },
  },
  { timestamps: true }
);

const AddData = mongoose.model("addData", addDataSchema);

// Upload file to Cloudinary
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (typeof localFilePath !== "string") {
      throw new Error("Local file path must be a string");
    }

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    console.error(`Error uploading to Cloudinary: ${error.message}`);

    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
        console.error(`Deleted local file due to error: ${localFilePath}`);
      } catch (unlinkError) {
        console.error(`Error deleting local file: ${unlinkError.message}`);
      }
    }

    return null;
  }
};

// Controller functions
const postForm = async (req, res) => {
  try {
    const {
      userName,
      userEmail,
      ingredients,
      size,
      prodCost,
      prodServer,
      prodDescription,
      apiKey
    } = req.body;

    // Validate API key
    if (apiKey !== process.env.YOUR_API_KEY) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    // Extract file paths from req.files
    const prodImg1Path = req.files["prodImg1"][0].path;
    const prodImg2Path = req.files["prodImg2"][0].path;
    const prodImg3Path = req.files["prodImg3"][0].path;
    const prodImg4Path = req.files["prodImg4"][0].path;
    const prodVideoPath = req.files["prodVideo"][0].path;

    // Handle file uploads and get their URLs
    const [
      prodImage1Url,
      prodImage2Url,
      prodImage3Url,
      prodImage4Url,
      prodVideoUrl,
    ] = await Promise.all([
      uploadOnCloudinary(prodImg1Path),
      uploadOnCloudinary(prodImg2Path),
      uploadOnCloudinary(prodImg3Path),
      uploadOnCloudinary(prodImg4Path),
      uploadOnCloudinary(prodVideoPath),
    ]);

    // Create new data entry in MongoDB
    const addData = await AddData.create({
      userName,
      userEmail,
      ingredients,
      size,
      prodImg1: prodImage1Url.secure_url,
      prodImg2: prodImage2Url.secure_url,
      prodImg3: prodImage3Url.secure_url,
      prodImg4: prodImage4Url.secure_url,
      prodVideo: prodVideoUrl.secure_url,
      prodCost,
      prodServer,
      prodDescription,
    });

    // Handle response based on success or failure
    if (!addData) {
      return res.status(500).json({
        message: "Something went wrong while adding data",
        success: false,
      });
    }

    return res.status(201).json({
      message: "Data added successfully",
      success: true,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error adding data",
      success: false,
    });
  }
};

const getFormData = async (req, res) => {
  try {
    const { userName, userEmail, apiKey } = req.body;
    
    if (!userName || !userEmail || !apiKey) {
      return res.status(400).json({
        message: "Bad Request: Missing required fields",
        success: false,
      });
    }

    if (apiKey !== process.env.YOUR_API_KEY) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const data = await AddData.find({ userName, userEmail });
    if (data.length === 0) {
      return res.status(404).json({
        message: "No Data Found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Data Fetched Successfully",
      success: true,
      data: data, // Include the fetched data in the response
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error in getting Data",
      success: false,
    });
  }
};

// CORS configuration
const corsConfig = { 
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};

app.options('*', cors(corsConfig));
app.use(cors(corsConfig));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: false }));
app.use("/uploads", express.static("uploads"));

// Routes
app.post(
  "/api/add/v1/addData",
  upload.fields([
    { name: "prodImg1", maxCount: 1 },
    { name: "prodImg2", maxCount: 1 },
    { name: "prodImg3", maxCount: 1 },
    { name: "prodImg4", maxCount: 1 },
    { name: "prodVideo", maxCount: 1 },
  ]),
  postForm
);

app.post('/api/get/v1/getdata', getFormData);

app.get('/', (req, res) => {
  res.json('server is healthy!!!');
});

// Connect to MongoDB and start server
connectToMongo()
  .then(() => {
    app.listen(process.env.PORT || 3001, () => {
      console.log(`Server is running at port: ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("MongoDb Connection Failed", err);
  });

module.exports = app;
