export default {
  product: {
    writeIndex: {
      primaryKey: true,
      partKey: "TablePartKey",
      sortKey: "TableSortKey",
    },
    readIndex: {
      primaryKey: false,
      partKey: "Index1PartKey",
      sortKey: "Index1SortKey",
    },
    creators: {
      owner: ["p_id", "p_name", "p_buying_price", "p_selling_price"],
      manager: ["p_id", "p_name"],
    },
    removers: { owner: [] },
    updaters: {
      owner: ["p_id", "p_name", "p_buying_price", "p_selling_price"],
      manager: ["p_name"],
    },
    readers: {
      owner: ["p_id", "p_name", "p_buying_price", "p_selling_price"],
      manager: ["p_id", "p_name", "p_buying_price", "p_selling_price"],
      customer: ["p_id", "p_name", "p_selling_price"],
    },
  },
  feedback: {
    partitionKey: "PartKey2",
    sortKey: "SortKey2",
    creators: ["customer"],
    removers: [],
    updaters: {
      owner: ["r_reviewed"],
      manager: ["r_reviewed"],
      customer: ["r_content"],
    },
    readers: {
      owner: ["r_content", "r_reviewed"],
      manager: ["r_content", "r_reviewed"],
      customer: ["r_content", "r_reviewed"],
    },
  },
};
