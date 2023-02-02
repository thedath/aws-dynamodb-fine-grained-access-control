export default function toDynamoDBInputItems(obj: { [key: string]: any }) {
  const itemsObj: { [key: string]: { S: any } } = {};
  Object.keys(obj).forEach((key) => {
    itemsObj[key] = { S: obj[key] };
  });

  return itemsObj;
}
