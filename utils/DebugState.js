let debugMessagesEnabled = false;

export const setDebugMessagesEnabled = (value) => {
    debugMessagesEnabled = !!value;
};

export const isDebugMessagesEnabled = () => debugMessagesEnabled;
