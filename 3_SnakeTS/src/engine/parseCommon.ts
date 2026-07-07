export const parseCommon = {
    // 1. 全部改大寫
    toUpperCase: function (str: string): string {
        if (typeof str !== 'string') return '';
        return str.toUpperCase();
    },

    // 2. 全部改小寫
    toLowerCase: function (str): string {
        if (typeof str !== 'string') return '';
        return str.toLowerCase();
    },

    // 3. 第一個字大寫，其它小寫
    toCapitalize: function (str): string {
        if (typeof str !== 'string' || str.length === 0) return '';
        // 取第一個字轉大寫 + 剩餘的字轉小寫
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
};