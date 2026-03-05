import { Schema, model, ObjectId } from "mongoose";
const { APP_NAME = "vtu", PAYMENT_BANK_NAME = "9PSB", ASSISTANT_KEY = "visit console.groq.come to obtain one", PAYMENT_HASH_KEY = 'visit flutterwave to obtain one', PAYMENT_KEY = "visit flutterwave to obtain and change", SERVICE_KEY = "visit inlomax data to obtain and change", PAYMENT_KEY2 = "visit billstack to obtain one" } = process.env;

const NETWORKS = ["MTN", "AIRTEL", "GLO", "9MOBILE"];
const PLAN_TYPES = ["SME", "GIFTING", "CORPORATE GIFTING", "AWOOF", "SOCIAL", "TALK", "CORPORATE", "SME2", "SHARE"];

const profitMargins = {
  airtime: 10, // %
  data: 50, // per gb
  cable: 500, // fixed
  electricity: 500, // fixed
  education: 500, // fixed
};

const defaultApiKeys = {
  services: SERVICE_KEY,
  payment: PAYMENT_KEY,
  assistant: ASSISTANT_KEY,
  paymentHash: PAYMENT_HASH_KEY,
  paymentkey2: PAYMENT_KEY2
};

const generateDataNetworks = () =>
  NETWORKS.map((network, i) => ({
    name: network,
    id: i + 1,
    plans: PLAN_TYPES,
    active: true,
    margin: profitMargins.data,
  }));

const generateAirtimeNetworks = () =>
  NETWORKS.map((network, i) => ({
    name: network,
    id: i + 1,
    active: true,
    margin: profitMargins.airtime,
  }));

const defaultCable = () => [
  { name: "DSCable", code: "dscable", margin: profitMargins.cable, active: true },
  { name: "GOCable", code: "gocable", margin: profitMargins.cable, active: true },
  { name: "STARTIMES", code: "startimes", margin: profitMargins.cable, active: true },
];

const defaultElectricity = () => [
  { name: "IKEDC", code: "ikeja", margin: profitMargins.electricity, active: true },
  { name: "EKEDC", code: "eko", margin: profitMargins.electricity, active: true },
  { name: "KEDCO", code: "kedco", margin: profitMargins.electricity, active: true },
  { name: "AEDC", code: "aedc", margin: profitMargins.electricity, active: true },
  { name: "IBEDC", code: "ibedc", margin: profitMargins.electricity, active: true },
  { name: "JED", code: "jed", margin: profitMargins.electricity, active: true },
  { name: "KAEDCO", code: "kaedco", margin: profitMargins.electricity, active: true },
  { name: "PHED", code: "phed", margin: profitMargins.electricity, active: true },
  { name: "YEDC", code: "yola", margin: profitMargins.electricity, active: true },
];

const defaultEducation = () => [
  { name: "WAEC", code: "waec", margin: 30, active: true },
  { name: "NECO", code: "neco", margin: 30, active: true },
  { name: "JAMB", code: "jamb", margin: 30, active: true },
];

const defaultRechargeCard = () =>
  NETWORKS.map((network, i) => ({
    name: network,
    id: i + 1,
    active: true,
    margin: 5,
  }));

const defaultPackages = [
  {
    name: "basic",
    description: "this package is for normal users who want to buy our services at cheaper rate focusing mainly on personal use rather than connecting there software or website",
    discount: 0,
    price: 0,
  },
  {
    name: "retailer",
    description: "this package is for retailers who want to vend our services at cheaper rate to there customers, either inside there website or shop , this package come with api access and 50% off fee for our services",
    discount: 50,
    price: 10000,
  },
];

const defaultFundingDetails = {
  accountNumber: "8145742404",
  accountName: "Abubakar Muhammad",
  bankName: "opay",
  fee: {
    percent: 2,
    fixed: 30
  }
}

const defaultContacts = [
  {
    name: "admin1",
    number: "08145742404",
  },
];

const defaultCampaigns = [
  {
    message: `share our app to your 10 friends suggesting is very cheap and reliable, let them register and fund there wallet buy our services,  and dm our us on ${defaultContacts[0].number} for your big reward`,
    name: "promotion",
  },
];

const defaultUserMaxStorage = 20;
const defaultAdminEnums = ["customerService", "partnerService", "pricingService", "supportService"]

const ConfigSchema = new Schema({
  apiKeys: {
    type: {
      payment: String,
      services: String,
      assistant: String,
      paymentHash: String,
      emailappkey: String, 
      emailaddress: String,
      paymentkey2: String
    },
    default: defaultApiKeys
  },
  
  paymentBankName: {
    type: String, 
    default: PAYMENT_BANK_NAME
  },
  
  assistant: {
    type: Boolean,
    default: false
  },
  
  upcoming: {
    type: String, // this are upcoming features post link at s-post
    default: ""
  },
  
  autoSwitchAPI: {
    enabled: { type: Boolean, default: true },
    mode: { type: String, default: "fallback" },
  },

  services: {
    data: {
      active: {
        type: Boolean,
        default: true,
      },
      plans: {
        type: [String],
        default: PLAN_TYPES,
      },
      networks: {
        type: [
          {
            name: String,
            id: Number,
            plans: [String],
            margin: Number,
            active: Boolean,
          },
        ],
        default: generateDataNetworks,
      },
    },

    airtime: {
      active: {
        type: Boolean,
        default: true,
      },
      networks: {
        type: [
          {
            name: String,
            id: Number,
            margin: Number,
            active: Boolean,
          },
        ],
        default: generateAirtimeNetworks,
      },
    },

    cable: {
      active: {
        type: Boolean,
        default: true,
      },
      providers: {
        type: [
          {
            name: String,
            code: String,
            margin: Number,
            active: Boolean,
          },
        ],
        default: defaultCable,
      },
    },

    electricity: {
      active: {
        type: Boolean,
        default: true,
      },
      discos: {
        type: [
          {
            name: String,
            code: String,
            margin: Number,
            active: Boolean,
          },
        ],
        default: defaultElectricity,
      },
    },

    education: {
      active: {
        type: Boolean,
        default: true,
      },
      exams: {
        type: [
          {
            name: String,
            code: String,
            margin: Number,
            active: Boolean,
          },
        ],
        default: defaultEducation,
      },
    },

    rechargeCard: {
      active: {
        type: Boolean,
        default: true,
      },
      networks: {
        type: [
          {
            name: String,
            id: Number,
            margin: Number,
            active: Boolean,
          },
        ],
        default: defaultRechargeCard,
      },
    },
  },
  
  appName: {
    type: String,
    default: APP_NAME,
  },
  
  broadCastMessage: {
    type: String,
    message: `welcome to ${APP_NAME}, we are registered vtu platform that offer subscription and billing like data airtime electricity etc at lowest prices , our main focus us cheapness and reliability`,
  },
  
  contacts: {
    type: [
      {
        name: String,
        number: String,
      },
    ],
    default: defaultContacts,
  },
  
  admins: {
    type: [
      {
        _id: Schema.Types.ObjectId,
        permissions: {
          type: [String],
          enum: defaultAdminEnums,
          default: ["customerService"],
        },
      },
    ],
  },
  
  packages: {
    type: [
      {
        name: String,
        price: Number,
        description: String,
        discount: Number
      },
    ],
    default: defaultPackages,
  },
  
  fundingDetails: {
    type: {
      accountNumber: {
        type: String,
        required: true
      },
      accountName: {
        type: String,
        required: true
      },
      bankName: {
        type: String,
        required: true
      },
      description: {
        type: String, 
        description: "send your money to this account numbers copy your email and send us proof of your transfer and email to our support number 08145742404"
      },
      fee: {
        percent: {
          type: Number,
          default: 0
        },
        fixed: {
          type: Number,
          default: 0
        },
        startAmount: {
          type: Number,
          default: 0
        }
      }
    },
    default: defaultFundingDetails,
  },
  
  bulkPurchasing: {
    type: Boolean,
    default: true,
  },
  
  testingMode: {
    type: Boolean,
    default: true,
  },
  
  campaigns: {
    type: [
      {
        createdAt: {
          type: Date,
          default: Date.now,
        },
        message: String,
        name: String,
      },
    ],
    default: defaultCampaigns,
  },
  
  affliate: {
    type: Boolean,
    default: true
  },
  
  whatsapp: {
    type: String
  },
  
  maintainance: {
    type: Boolean,
    default: false
  },
  
  developer: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now()
  },
 
 updatedAt: {
    type: Date,
    default: Date.now()
  },
 
  maxContactStorage: {
    type: Number,
    default: defaultUserMaxStorage,
  },
  
  maxChatStorage: {
    type: Number,
    default: defaultUserMaxStorage,
  },
});

const Configuration = model("vtu_configuration", ConfigSchema);

export {
  Configuration,
  defaultCable,
  defaultApiKeys,
  defaultCampaigns,
  defaultContacts,
  defaultPackages,
  defaultFundingDetails,
  defaultEducation,
  defaultRechargeCard,
  defaultUserMaxStorage,
  defaultElectricity,
  NETWORKS,
  PLAN_TYPES,
  profitMargins,
  generateDataNetworks,
  defaultAdminEnums,
  generateAirtimeNetworks
}