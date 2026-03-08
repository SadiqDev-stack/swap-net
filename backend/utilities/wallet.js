
const getTransactionDescription = (type, meta) =>  {
  switch (type){
    case 'swapping': 
     return `you succesfully swap your currency from ${meta.from}${meta.amount} to ${meta.to}${meta.convertedAmount}`;
     break;

     default: ''
  }
}

export {
    getTransactionDescription
}