const {APP_NAME = "SADIQ SHARP SUB app", SENDER_MAIL = "sadiqmuh1321@gmail.com"} = process.env;
import {composeMail} from "../utilities/general.js";
import {log} from "../middlewares/logger.js"

const templates = {
  confirmation: data => {
    let {title = data.subject, req, description, url, buttonText} = data;

    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
      
      body {
        margin: 0;
        padding: 0;
        background: white;
        color: black;
        font-family:  Arial, sans-serif;
      }
      
      table {
        border-spacing: 0;
      }
      
      img {
        border: 0;
        display: block;
      }
      
      .container {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        background: #131a25;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(0, 180, 216, 0.3);
      }
      
      .header {
      background: navy;
        padding: 30px 20px;
        text-align: center;
      }
      
      .logo {
        font-size: 2rem;
        width: 50px;
        height: 50px;
        font-weight: 700;
        color: dark-gray;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
      
      .content {
        padding: 40px 30px;
      }
      
      .title {
        color: black;
        font-size: 28px;
        font-weight: 700;
        text-align: center;
        margin-bottom: 20px;
        text-shadow: 0 0 10px rgba(0, 180, 216, 0.3);
      }
      
      .description {
        color: dark-gray;
        font-size: 16px;
        line-height: 1.6;
        text-align: center;
        margin-bottom: 30px;
      }
      
      .button {
        display: inline-block;
        background: linear-gradient(135deg, #00b4d8 0%, #0090b8 100%);
        color: #0b0f17 !important;
        text-decoration: none;
        padding: 16px 32px;
        border-radius: 50px;
        font-weight: 600;
        font-size: 16px;
        text-align: center;
        transition: all 0.3s ease;
        box-shadow: 0 5px 15px rgba(0, 180, 216, 0.3);
        border: none;
        cursor: pointer;
      }
      
      .button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 180, 216, 0.5);
      }
      
      .footer {
        background: rgba(0, 0, 0, 0.3);
        padding: 25px 20px;
        text-align: center;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .footer-text {
        color: navy;
        font-size: 14px;
        margin: 0;
      }
      
      @media only screen and (max-width: 600px) {
        .content {
          padding: 30px 20px;
        }
        
        .title {
          font-size: 24px;
        }
        
        .button {
          padding: 14px 28px;
          font-size: 15px;
        }
      }
    </style>
  </head>
  <body>
    <center style="width: 100%; table-layout: fixed; background: linear-gradient(135deg, #0b0f17 0%, #131a25 100%); padding: 40px 20px;">
      <table class="container" cellpadding="0" cellspacing="0" role="presentation">
        <!-- Header -->
        <tr>
          <td class="header">
            <div class="logo">
              <img src="${req.domain}/images/logo.png">
            </div>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td class="content">
            <h1 class="title">${title}</h1>
            
            <p class="description">
              ${description}
            </p>
            
            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" class="button">
                ${buttonText}
              </a>
            </div>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td class="footer">
            <p class="footer-text">
              &copy; Sadiq Sharp Sub Copyright
            </p>
          </td>
        </tr>
      </table>
    </center>
  </body>
</html>
    `
  },
  
  
  message: data => {
    const {title = "SADIQ SHARP SUB ", spinner = false, req, description = "Please Wait While We Redirect You To The Right Destination", redirectTime = 3000, redirect = "/index.html"} = data;
    
    return `
      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>${title}</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    
    body{
      background: white;
      color: white;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      row-gap: 1rem;
      color: navy;
      text-align: left;
      font-family: Arial, helvatica, fantasy;
      justify-content: center;
    }
    
    .title{
      color: navy;
    }
    
.description{
  color: gray;
  width: 95%;
  text-align: left;
}

.spinner{
  width: 50px;
  height: 50px;
  border: 3px solid navy;
  border-top: 2px solid transparent;
  background: transparent;
  animation: spin 1s 0s infinite linear;
  border-radius: 50%;
  margin: 3rem 0;
}

@keyframes spin{
  to {
    transform: rotateZ(360deg) ;
  }
}

.logo{
  font-size: 1rem;
  width: 50px;
  height: 50px
}
    
    
  </style>
</head>
<body>
  
  <h2 class="title">${title}</h2>
 
<img class="logo" alt="app logo" src="${req.domain}/images/logo.png" />
  
  <div class="description">
    ${description}
   </div>
   
  ${spinner ? '<div class="spinner"></div>' : ""}
  
  <script>
  
   const delay = ${redirectTime};
   const redirect = '${redirect}'
    
    if(redirect !== 'false' && redirect){
    setTimeout(() => {
      location.replace(redirect)
    }, ${redirectTime})
    }
  </script>
</body>
</html>
    `
  }
}


const sendMail = async (data = {}, req, cb = () => null) => {
  try{
  data = {...{
  subject: `confirm your Sadiq Sharp Sub account`,
  template: "confirmation",
  buttonText: "confirm account",
  description: "this is to make sure the owner of this email is the one signing up an account, please click on the link to confirm your account",
  req,
  email: SENDER_MAIL,
  mail: data.email || SENDER_MAIL,
  url: `${req.domain}/api/user/verify?token=${req.token}&type=email`
  }, ...data}
  
  if(typeof data.email !== "string"){
    data = {...data, bcc: data.email};
  }
  const template = templates[data.template](data);
  const sent = await composeMail(req, data.mail, data.subject, template, data)
    cb(sent)
    console.log(sent)
  }catch(er){
    console.log(er)
    log(er, "bad")
    cb(false)
  }
}

export  {
  sendMail,
  templates
}