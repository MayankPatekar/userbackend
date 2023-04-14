// require("dotenv").config({path: "../config.env"})
// import "../config.env"
// import * as dotenv from 'dotenv';
// dotenv.config()
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import * as dotenv from 'dotenv' 
dotenv.config()

const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.use(cors());

mongoose.connect(
  process.env.mongoose_connect,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const emailSchema = new mongoose.Schema(
  {
    Email: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    fname: {
      type: String,
      required: [true, "Enter First Name."],
    },
    lname: {
      type: String,
      required: [true, "Enter Last Name."],
    },
    email: {
      type: String,
      required: [true, "Enter valid Email."],
    },
    phone: {
      type: String,
      require: [true, "Enter Phone Number"],
    },
    password: {
      type: String,
      required: [true, "Please enter password"],
      // select:false
    },
    points: Number,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    points: Number,
    // orders:[[]],
    // address:[[]],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
userSchema.methods.matchPasswords = async function (password) {
  return await bcrypt.compare(password, this.password);
};
userSchema.methods.getSignedToken = function () {
  return jwt.sign({ id: this._id }, "hcnsjf739dnsjnejwnds934lfgjnkmd0i", {
    // expiresIn: process.env.JWT_EXPIRE,
    expiresIn: "2147483647",
  });
};
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpire = Date.now() + 10 * (60 * 1000);
  return resetToken;
};

let protect = async (req, res, next) => {
  let token = undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Classic")
  ) {
    console.log(req.headers.authorization);
    let tokenId = req.headers.authorization.split(" ");
    // console.log(token);
    // console.log(tokenId)
    token = tokenId[1];
  }

  if (!token) {
    return next(res.status(401).send({ message: "unauthorized access" }));
  }

  try {
    const decoded = jwt.verify(token, "hcnsjf739dnsjnejwnds934lfgjnkmd0i");
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(res.status(404).send({ message: "user Not Found" }));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(res.status(401).send({ message: "not authorized" }));
  }
};

const sendEmail = (options) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.outLook_user, // sender email
      pass: process.env.outLook_pass, // sender password
    },
  });

  // console.log(options.to)
  const mailOptions = {
    from: process.env.outLook_user,
    to: options.to,
    subject: options.subject,
    html: options.text,
  };

  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log(err);
      console.log("error");
    } else {
      console.log(info);
      console.log("info");
    }
  });
};
function generateOrderId() {
  const min = 100000;
  const max = 999999;
  const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
  const orderId = crypto.randomBytes(3).toString('hex') + randomNum;
  return orderId;
}

const productSchema = new mongoose.Schema(
  {
    ProductName: String,
    ProductBrand: String,
    Description: String,
    Category: [String],
    SubCategory: String,
    Types: [
      {
        typeNo: Number,
        unit: String,
        size: Number,
        price: Number,
        quantity: Number,
      },
    ],
    Image: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true }
);

// order Schema
const orderSchema = new mongoose.Schema(
  {
    OrderId:{type:String,require:true},
    Items: [],
    shippingDetails: [],
    userId: String,
    isDelivered: Boolean,
    isPaid: Boolean,
    isPacked: Boolean,
    isShipped: Boolean,
    isCanceled: Boolean,
    TotalAmount: Number,
    TotalPointsRecived: Number,
    TotalPointsApply: Number,
    TotalQuantity: Number,
    date: Date,
  },
  { timestamps: true }
);

orderSchema.pre("save", function (next) {
  if (!this.date) {
    this.date = new Date().setHours(0, 0, 0, 0);
  }
  next();
});

// user model
const User = new mongoose.model("User", userSchema);
//product model
const Product = new mongoose.model("Product", productSchema);
// email model
const Email = new mongoose.model("Email", emailSchema);
// order model
const Order = new mongoose.model("Order", orderSchema);

const sendToken = (user, statusCode, res) => {
  const token = user.getSignedToken();
  res.status(statusCode).send({ message: "success", token });
};

app.post("/signin", async (req, res) => {
  const { Email, Password } = req.body;
  try {
    const user = await User.findOne({ email: Email }).select("+password");
    // console.log(user)
    if (user) {
      const isMatch = await user.matchPasswords(Password);
      // console.log(isMatch)
      if (isMatch) {
        sendToken(user, 200, res);
      } else {
        res.status(401).send({ message: "invalid password" });
      }
    } else {
      res.status(401).send({ message: "Invalid Username" });
    }
  } catch (err) {
    console.log(err);
  }

  // User.findOne({username : UserName},(err,user)=>{
  //     if(user){

  //             // bcrypt.compare(Password,user.Password).then(isMatch =>{
  //             //     console.log(isMatch)
  //             // }).catch(err=>{

  //             //     console.log(err);
  //             // })

  //             // console.log(isMatch)
  //             const isMatch =  user.matchPasswords(Password);
  //             if(isMatch){
  //                 res.send({message:"Login Successfully...", user : user,isSignIn:true})
  //             }else{
  //                 res.send({ message:"Wrong Password"})
  //             }

  //     }else{
  //         res.send({message:"User Not Found..."})
  //     }
  // })
});

app.post("/signup", async (req, res) => {
  const { FName, LName, Email, Phone, Password } = req.body;
  try {
    const user = await User.findOne({ email: Email });

    if (user) {
      res.send({ message: "User already exsist ..." });
    } else {
      const user = new User({
        fname: FName,
        lname: LName,
        email: Email,
        phone: Phone,
        password: Password,
        points: 0,
      });

      //To save data to the database with error handling
      user.save((err) => {
        if (err) {
          res.send(err);
        } else {
          sendToken(user, 201, res);
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// app.post("/signup",(req,res) =>{
//     const {UserName , Name , Email , Password } = req.body;
//     console.log("apper here .....")
//     User.findOne({email:Email},(err,user)=>{
//         console.log(user)
//     if(user){
//         res.send({message:"User already exsist ..."})
//     }else{
//         // we directly pass name becaus we have same name as in schema
//         // otherwise use field_name : value ,

//         // const {UserName , Name , Email , Password } = req.body;
//         // console.log(username + name + email+password)

//         const user = new User({
//             username :UserName,
//             name : Name,
//             email: Email,
//             password: Password
//         })

//         //To save data to the database with error handling
//         user.save(err =>{
//             if(err){
//                 res.send(err)

//             }else{
//                 sendToken(user, 201 , res)
//             }
//         })

//     }
// })

// })

app.post("/forgotpassword", async (req, res, next) => {
  const { Email } = req.body;

  try {
    const user = await User.findOne({ email: Email });
    if (!user) {
      console.log(Email);
      return next(res.status(404).send({ message: "Email could not be send" }));
    }
    const resetToken = user.getResetPasswordToken();
    await user.save();
    const resetUrl = `http://localhost:3000/resetpassword/${resetToken}`;
    const message = `<h1>Reset Password link</h1><p>click on the link to reset password</p><a href=${resetUrl} clicktracking=off>${resetUrl}</a>`;

    console.log(resetUrl);
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        text: message,
      });
      res.status(200).send({ message: "Email Sent" });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return next(res.status(500).send({ message: "Email could not be send" }));
    }
  } catch (err) {
    next(err);
  }
});

app.put("/resetpassword/:resetToken", async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.resetToken)
    .digest("hex");
  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(res.status(400).send({ message: "Invalid reset token" }));
    }
    user.password = req.body.Password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(201).send({ message: "Password Reset Success" });
  } catch (err) {
    next(err);
  }
});

app.get("/profile", protect, async (req, res, next) => {
  const user = req.user;
  // console.log(user);
  res.send({ user: user });
});

app.post("/profile", protect, async (req, res, next) => {
  const user = req.user;
  const { fname, lname, email, phone } = req.body;
  if (!(fname === "")) {
    user.fname = fname;
  }
  if (!(lname === "")) {
    user.lname = lname;
  }
  if (!(email === "")) {
    user.email = email;
  }
  if (!(phone === "")) {
    user.phone = phone;
  }
  try {
    await user.save();
    console.log(user);
    res.send({ message: "Profile updated successfully", user: user });
  } catch (err) {
    res.send(err);
  }
});

app.get("/findpoints", protect, async (req, res, next) => {
  const user = req.user;
  res.send({ points: user.points });
});

app.post("/placeorder", protect, async (req, res, next) => {
  const user = req.user;
  const { cart, shipinfo, applyPoints } = req.body;

  const cartItems = cart.cartItems;
  // console.log(shipinfo)
  const shippingInfo = shipinfo;
  const pointRecivedToUser = cart.cartTotalPoints;
  const totalAmount = cart.cartTotalAmount - applyPoints;
  const cartQuantity = cart.cartTotalQuantity;
  console.log(user);
  const orderid = generateOrderId()
  if (user.points >= applyPoints) {
    const order = new Order({
      OrderId:orderid,
      Items: cartItems,
      shippingDetails: shippingInfo,
      userId: user._id,
      isDelivered: false,
      isPaid: false,
      isPacked: false,
      isShipped: false,
      isCanceled: false,
      TotalAmount: totalAmount,
      TotalPointsRecived: pointRecivedToUser,
      TotalPointsApply: applyPoints,
      TotalQuantity: cartQuantity,
    });

    order.save((err) => {
      if (err) {
        res.send(err);
      } else {
        res.send({ message: "Order Placed successfully" });
        const message=`<p><strong>${user.fname} ${user.lname}</strong> your order is been confirm.
        </p><p>Your order id is #<strong>${orderid}</strong></p>
        <p>Total Points Apply : <strong>${applyPoints}</strong></p>
        <p>Total Amount : <strong>${totalAmount}</strong></p>
        <p>Total Points Received : <strong>${pointRecivedToUser}</strong></p>
        <p>check your profile to see the status of your order .</p>
        <p>For any queries contact to us at `
        +`<a href="mailto:alayna2k23@gmail.com">alayna2k23@gmail.com</a>`
        +`</p>`
        +`<h3>Happy shopping,<br/>Have a great day.</h3>
        `;
        sendEmail({
        to : "mayankpatekar112345@gmail.com",
        subject:`Your order is confirm with Alayna`,
        text : message
    })
      }
    });
    user.points = user.points - applyPoints;
    await user.save();
    // user.points = user.points + pointRecivedToUser;
    // await user.save();

    cartItems.forEach((Item) => {
      Item.Types.forEach(async (IType) => {
        if (IType.size === Item.SelectedSize) {
          const prod = await Product.findOne({ _id: Item._id });
          console.log(prod);
          prod.Types.forEach((PType) => {
            if (PType.size === Item.SelectedSize) {
              PType.quantity = PType.quantity - Item.cartQuantity;
            }
          });
          prod.save();
        }
      });
    });
  } else {
    res.send({ message: "Incufficient points" });
  }
});

app.post("/cancelorder", protect, async (req, res) => {
  try {
    const id = req.body.id;
    const user = req.user;
    const order = await Order.findOne({ _id: id });
    order.isCanceled = true;
    await order.save();
    user.points = user.points + order.TotalPointsApply;
    await user.save();

    order.Items.forEach(async (Item) => {
      const product = await Product.findOne({ _id: Item._id });

      product.Types.forEach((type) => {
        if (type.size === Item.SelectedSize) {
          type.quantity = type.quantity + Item.cartQuantity;
        }
      });
      await product.save();
    });

    res.status(200).send({ message: "Order cancel successfully" });
  } catch (err) {
    res.send({ message: "error occure" });
  }
});

app.get("/api/orders", protect, async (req, res) => {
  const user = req.user;
  const userOrders = await Order.find({
    userId: user._id,
  });

  if (userOrders) {
    res.send({ orders: userOrders });
  } else {
    res.send({ message: "No Orders Found" });
  }
});

/////////////////apis for product //////////////////////

app.get("/api/products/search", async (req, res) => {
  const searchQuery = req.query.q;
  // const searchTerms = searchQuery.split(',').map((term)=>term.trim());

  try {
    const products = await Product.find({
      $or: [
        { ProductName: { $regex: searchQuery, $options: "i" } },
        { Description: { $regex: searchQuery, $options: "i" } },
        { ProductBrand: { $regex: searchQuery, $options: "i" } },
        { Category: { $regex: searchQuery, $options: "i" } },
      ],
      // $or:[
      //     {ProductName:{$in:searchTerms}},
      //     {Description:{$in:searchTerms}},
      //     {ProductBrand:{$in:searchTerms}},
      //     {
      //         name:{$regex:searchQuery,$options:"i"}

      //         // $or:[
      //         //     {ProductName:{$regex:searchQuery,$options:'i'}},
      //         //     {Description:{$regex:searchQuery,$options:'i'}},
      //         // ],
      //     }
      // ]
    });
    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "server error" });
  }
});

app.post("/api/products", (req, res) => {
  const { name, Description, tags, skus, minAge, maxAge } = req.body;

  const product = new Product({
    Name: name,
    Description: Description,
    tags: [...tags],
    SKUs: [...skus],
    minAge: minAge,
    maxAge: maxAge,
  });

  product.save((err) => {
    if (err) {
      res.send(err);
    } else {
      res.status(200).send({ message: "Product is added ..." });
    }
  });
});

app.get("/api/products", protect, (req, res, next) => {
  Product.find({}, (err, results) => {
    if (!err) {
      console.log(results);
      res.send({ products: results });
    } else {
      res.send({ message: err });
    }
  });
});

app.get("/api/product/:id", (req, res) => {
  const id = req.params.id;
  // console.log(req.params.id);
  Product.find({ _id: id }, (err, product) => {
    if (!err) {
      // console.log(product)
      res.send({ product: product });
    } else {
      res.send({ message: err });
    }
  });
});

app.get("/api/shop/:category", (req, res) => {
  const Category =
    req.params.category.charAt(0).toUpperCase() + req.params.category.slice(1);
  if (Category === "Men" || Category === "Women" || Category === "Kids") {
    // console.log(Category)
    Product.find({ Category: Category }, (err, products) => {
      if (!err) {
        if (products) {
          res.send({ products: products });
        } else {
          res.send({ message: "Product not Added" });
        }
      } else {
        res.send({ message: err });
      }
    });
  } else {
    res.status(404).send({ message: "category not found" });
  }
});

app.get("/api/category/:subcategory", (req, res) => {
  const subcategory = req.params.subcategory;

  let search = "";

  if (subcategory === "facewash") {
    search = "Face Wash";
  } else if (subcategory === "babycare") {
    search = "Baby Care";
  } else if (subcategory === "lipstick") {
    search = "Lipstick";
  } else if (subcategory === "shaving") {
    search = "Shaving";
  } else {
    search = "";
  }

  if (search != "") {
    Product.find({ SubCategory: search }, (err, products) => {
      if (!err) {
        res.send({ products: products });

        // res.send({message:"Product Not Found"})
      } else {
        res.send({ message: err });
      }
    });
  } else {
    res.send({ message: "No Such Category" });
  }
});

app.get("/api/brand/mamaearth", (req, res) => {
  Product.find({ ProductBrand: "Mamaearth" }, (err, products) => {
    if (!err) {
      res.send({ products: products });

      // res.send({message:"Product Not Found"})
    } else {
      res.send({ message: err });
    }
  });
});

app.put("/api/points/share", protect, async (req, res) => {
  const sender = req.user;
  const { Email, Amount } = req.body;
  const reciverEmail = Email;
  if(sender.email === reciverEmail){
res.send({message:"Can't share points"})
  }else{

    const amount = Number(Amount);
    console.log(Email)
  console.log(typeof amount);
  try {
    console.log(typeof sender.points);

    const reciver = await User.findOne({ email: reciverEmail });

    if (!reciver) {
      res.status(404).send({ message: "Reciver not found..." });
    } else {
      if (sender.points >= amount) {
        // console.log(reciver.points)
        sender.points = sender.points - amount;
        await sender.save();
        if (reciver.points === undefined) {
          reciver.points = amount;
        } else {
          reciver.points = reciver.points + amount;
        }
        console.log(reciver);
        await reciver.save();
        res.status(200).send({ message: "Loyalty points share successfully" });
      const message=`<p><strong>${sender.fname} ${sender.lname}</strong> share you <strong>Rs. ${Amount}</strong> .
      </p> <p>check your profile to insure that you have recived it in your account</p>`;
        await sendEmail({
        to : "mayankpatekar112345@gmail.com",
        subject:`${sender.fname} send you points`,
        text : message
    })
      } else {
        res.send({ message: "insuffiecient amount" });
      }
    }
  } catch (err) {
    res.send(err);
  }
}
});

app.post("/email/:email", async (req, res) => {
  const email = req.params.email;
  try {
    const em = await Email.findOne({ Email: email });

    if (em) {
      res.send({ message: "Already subscribe ..." });
    } else {
      const ema = new Email({ Email: email });

      //To save data to the database with error handling
      ema.save((err) => {
        if (err) {
          res.send(err);
        } else {
          res
            .status(200)
            .send({ code: 200, message: "THANKYOU !!! you are subscribed" });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
  // Email.find({Email:email},(err,e)=>{
  // if(e){
  //     res.send({message:"already subscribed"})
  // }else{
  //     const email = new Email({
  //         Email : email
  //     })

  //     email.save(err =>{
  //         if(err){
  //             res.send(err)
  //         }else{
  //             res.status(200).send({message :"THANKYOU !!! you are subscribed"})
  //         }
  //     })
  // }
  // if(err){
  //     res.status(404).send({message:"Somthin went wrong"})
  // }
  // })
});

const port = process.env.PORT || 3001;
app.listen(port, function () {
  console.log("Server is running on port 3001...");
});
