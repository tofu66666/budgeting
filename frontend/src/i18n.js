// Internationalization / i18n translations
// Supports: English (en) and Mandarin Chinese (zh)

const translations = {
  en: {
    // App title & branding
    appTitle: 'Budget Dashboard',
    appTagline: 'Personal spend & AI receipt intelligence',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signOut: 'Sign out',
    loginTitle: 'Budget AI Dashboard',
    loginSubtitle: 'Sign in to track spend & analyze receipts',
    username: 'Username',
    password: 'Password',
    accountName: 'Account name',
    accessKey: 'Access key',
    loggedIn: 'Logged in successfully',

    // Language
    language: 'Language',

    // Stats
    totalSpend: 'Total Spend',
    acrossAll: 'Across all recorded transactions',
    recurringObligations: 'Recurring Obligations',
    activeSubscriptions: '{count} active subscriptions',
    activeCategories: 'Active Categories',
    trackedGroups: 'Tracked expense groups',

    // Timeframe
    filterView: 'Filter View:',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    allTime: 'All Time',
    today: 'Today',
    jumpToDate: 'Jump to date',
    previousPeriod: 'Previous period',
    nextPeriod: 'Next period',
    allRecorded: 'All Recorded Transactions',

    // Charts
    spendByCategory: 'Spend by Category',
    allTimeCategoryDist: 'All-time category distribution',
    expensesFor: 'Expenses for {period}',
    dailyTrajectory: 'Daily Trajectory (7 Days)',
    weeklyDailyTrend: 'Weekly Daily Trend',
    monthlyTrend: 'Monthly Trend (Past 6 Months)',
    historicalTrend: 'Historical Monthly Trend',
    dayByDay: 'Day-by-day trend up to {date}',
    dailySpendingAcross: 'Daily spending across {period}',
    recentMonthly: 'Recent monthly timeline',
    macroTimeline: 'Macro timeline across all recorded months',
    daily: 'Daily',
    monthly: 'Monthly',

    // Transactions explorer
    transactionsExplorer: 'Transactions Explorer',
    filteredToActive: 'Filtered to active {timeframe}: {period}',
    allTransactions: 'All transactions across all time',
    searchPlaceholder: 'Search merchant, category, note…',
    filteredTo: 'Filtered to {timeframe}',
    showingAllTime: 'Showing All Time',
    transaction: 'transaction',
    transactions: 'transactions',
    entries: 'entries',

    // Add Spend
    addSpendRow: 'Add Spend Row',
    editSpendRow: 'Edit Spend Row',
    date: 'Date',
    amount: 'Amount ($)',
    category: 'Category',
    merchant: 'Merchant',
    merchantPlaceholder: "e.g. Trader Joe's, Uber",
    notes: 'Notes',
    optionalMemo: 'Optional memo',
    saveSpend: 'Save spend',
    updateSpend: 'Update spend',
    cancel: 'Cancel',
    spendAdded: 'Spend row added',
    spendUpdated: 'Spend updated',
    spendDeleted: 'Spend row deleted',

    // Categories
    groceries: 'Groceries',
    diningOut: 'Dining Out',
    utilities: 'Utilities',
    housing: 'Housing',
    transportation: 'Transportation',
    entertainment: 'Entertainment',
    shopping: 'Shopping',
    healthcare: 'Healthcare',
    personalCare: 'Personal Care',
    furniture: 'Furniture',
    luxury: 'Luxury',
    alcoholDrinks: 'Alcohol & Drinks',
    education: 'Education',
    travel: 'Travel',
    subscriptions: 'Subscriptions',
    insurance: 'Insurance',
    gifts: 'Gifts & Donations',
    discounts: 'Discounts & Adjustments',
    other: 'Other',

    // Receipt AI
    receiptAI: 'Gemini Receipt AI',
    apiKeyNeeded: 'API Key Needed',
    apiKeyNotSet: '⚠️ Gemini API Key not set. Click here to configure your key.',
    configure: 'Configure ↗',
    dateOverride: 'Date Override (Optional)',
    autoDetect: 'Auto-detect from receipt',
    dateHint: 'Leave blank to auto-detect the date from the receipt (falls back to today if unreadable)',
    receiptImage: 'Receipt Image',
    extractionPrompt: 'Extraction Prompt',
    resetPrompt: '↺ Reset Prompt',
    analyzeReceipt: '✨ Analyze Receipt Image',
    scanning: '✨ Scanning & Analyzing…',
    processingAI: 'Processing receipt with Gemini Multimodal AI…',
    chooseImage: 'Choose a receipt image first',
    optimizing: 'Optimizing receipt image…',
    processingGemini: 'Processing receipt with Gemini AI…',
    receiptAnalyzed: 'Receipt analyzed successfully',
    receiptImported: 'Receipt analyzed and {count} spend rows imported',
    imageTooLarge: 'Image exceeds server payload limits (4.5MB). Please upload a smaller photo.',

    // Recurring
    recurringExpenses: 'Recurring Expenses',
    editRecurring: 'Edit Recurring',
    addRecurring: 'Add Recurring Expense',
    name: 'Name',
    namePlaceholder: 'e.g. Netflix, Gym, Rent',
    frequency: 'Frequency',
    freqMonthly: 'Monthly',
    freqWeekly: 'Weekly',
    freqQuarterly: 'Quarterly',
    freqYearly: 'Yearly',
    nextDueDate: 'Next Due Date',
    notesDetails: 'Notes / details',
    saveRecurring: 'Save recurring',
    updateRecurringBtn: 'Update recurring',
    recurringCreated: 'Recurring expense saved',
    recurringUpdated: 'Recurring expense updated',
    recurringDeleted: 'Recurring expense deleted',
    subscriptionsCount: '{count} subscriptions',
    noRecurring: 'No recurring expenses registered',

    // Data tables
    transactionsTitle: 'Transactions',
    noSpend: 'No spend rows match your criteria',
    due: 'Due: {date}',
    edit: 'Edit',
    delete: 'Delete',
    unknownMerchant: 'Unknown Merchant',
    ai: '✨ AI',

    // API Key
    addApiKey: 'Add API Key',
    geminiConfigured: 'Gemini: {key}',
    geminiActive: 'Gemini: Active',
    geminiApiKey: '🔑 Gemini API Key',
    configuredKey: 'Configured key: {key}',
    noApiKey: 'No API key configured. Enter a Gemini key below to enable receipt scanning.',
    geminiDesc: 'Provide your Google Gemini API key to enable OCR and expense categorization via Gemini 3.5 Flash.',
    geminiKeyLabel: 'Gemini API Key',
    getKey: 'Get free Gemini API key ↗',
    saveKey: 'Save Key',
    saving: 'Saving…',
    keySaved: 'Gemini API key saved successfully',
    enterValidKey: 'Please enter a valid Gemini API key',
    failedSaveKey: 'Failed to save API key',
    hide: 'Hide',
    show: 'Show',
  },

  zh: {
    // App title & branding
    appTitle: '预算仪表盘',
    appTagline: '个人支出与AI收据智能分析',
    signIn: '登录',
    signingIn: '登录中…',
    signOut: '退出',
    loginTitle: '预算AI仪表盘',
    loginSubtitle: '登录以追踪支出并分析收据',
    username: '用户名',
    password: '密码',
    accountName: '账户名',
    accessKey: '访问密钥',
    loggedIn: '登录成功',

    // Language
    language: '语言',

    // Stats
    totalSpend: '总支出',
    acrossAll: '所有已记录交易的汇总',
    recurringObligations: '定期支出',
    activeSubscriptions: '{count} 个活跃订阅',
    activeCategories: '活跃类别',
    trackedGroups: '已追踪的费用分组',

    // Timeframe
    filterView: '筛选视图：',
    day: '日',
    week: '周',
    month: '月',
    allTime: '全部',
    today: '今天',
    jumpToDate: '跳转到日期',
    previousPeriod: '上一期',
    nextPeriod: '下一期',
    allRecorded: '所有已记录交易',

    // Charts
    spendByCategory: '按类别支出',
    allTimeCategoryDist: '全部时间类别分布',
    expensesFor: '{period}的支出',
    dailyTrajectory: '每日趋势（7天）',
    weeklyDailyTrend: '每周每日趋势',
    monthlyTrend: '月度趋势（近6个月）',
    historicalTrend: '历史月度趋势',
    dayByDay: '截至{date}的逐日趋势',
    dailySpendingAcross: '{period}的每日支出',
    recentMonthly: '近期月度时间线',
    macroTimeline: '所有记录月份的宏观时间线',
    daily: '每日',
    monthly: '每月',

    // Transactions explorer
    transactionsExplorer: '交易浏览器',
    filteredToActive: '已筛选至{timeframe}：{period}',
    allTransactions: '所有时间段的全部交易',
    searchPlaceholder: '搜索商户、类别、备注…',
    filteredTo: '已筛选至{timeframe}',
    showingAllTime: '显示全部时间',
    transaction: '笔交易',
    transactions: '笔交易',
    entries: '条记录',

    // Add Spend
    addSpendRow: '添加支出',
    editSpendRow: '编辑支出',
    date: '日期',
    amount: '金额（$）',
    category: '类别',
    merchant: '商户',
    merchantPlaceholder: '例如：超市、优步',
    notes: '备注',
    optionalMemo: '可选备忘',
    saveSpend: '保存支出',
    updateSpend: '更新支出',
    cancel: '取消',
    spendAdded: '支出已添加',
    spendUpdated: '支出已更新',
    spendDeleted: '支出已删除',

    // Categories
    groceries: '日用杂货',
    diningOut: '外出就餐',
    utilities: '水电煤气',
    housing: '住房',
    transportation: '交通出行',
    entertainment: '娱乐',
    shopping: '购物',
    healthcare: '医疗保健',
    personalCare: '个人护理',
    furniture: '家具家居',
    luxury: '奢侈品',
    alcoholDrinks: '酒水饮料',
    education: '教育',
    travel: '旅行',
    subscriptions: '订阅服务',
    insurance: '保险',
    gifts: '礼物与捐赠',
    discounts: '折扣与调整',
    other: '其他',

    // Receipt AI
    receiptAI: 'Gemini 收据AI',
    apiKeyNeeded: '需要API密钥',
    apiKeyNotSet: '⚠️ 未设置Gemini API密钥。点击此处配置。',
    configure: '配置 ↗',
    dateOverride: '日期覆盖（可选）',
    autoDetect: '从收据自动检测',
    dateHint: '留空以从收据自动检测日期（无法读取时默认使用今天的日期）',
    receiptImage: '收据图片',
    extractionPrompt: '提取提示词',
    resetPrompt: '↺ 重置提示词',
    analyzeReceipt: '✨ 分析收据图片',
    scanning: '✨ 扫描与分析中…',
    processingAI: '使用Gemini多模态AI处理收据中…',
    chooseImage: '请先选择收据图片',
    optimizing: '优化收据图片中…',
    processingGemini: '使用Gemini AI处理收据中…',
    receiptAnalyzed: '收据分析完成',
    receiptImported: '收据已分析并导入了{count}条支出记录',
    imageTooLarge: '图片超过服务器上传限制（4.5MB）。请上传较小的照片。',

    // Recurring
    recurringExpenses: '定期支出',
    editRecurring: '编辑定期支出',
    addRecurring: '添加定期支出',
    name: '名称',
    namePlaceholder: '例如：Netflix、健身房、房租',
    frequency: '频率',
    freqMonthly: '每月',
    freqWeekly: '每周',
    freqQuarterly: '每季度',
    freqYearly: '每年',
    nextDueDate: '下次到期日',
    notesDetails: '备注/详情',
    saveRecurring: '保存定期支出',
    updateRecurringBtn: '更新定期支出',
    recurringCreated: '定期支出已保存',
    recurringUpdated: '定期支出已更新',
    recurringDeleted: '定期支出已删除',
    subscriptionsCount: '{count} 个订阅',
    noRecurring: '暂无定期支出',

    // Data tables
    transactionsTitle: '交易记录',
    noSpend: '没有匹配的支出记录',
    due: '到期：{date}',
    edit: '编辑',
    delete: '删除',
    unknownMerchant: '未知商户',
    ai: '✨ AI',

    // API Key
    addApiKey: '添加API密钥',
    geminiConfigured: 'Gemini：{key}',
    geminiActive: 'Gemini：已激活',
    geminiApiKey: '🔑 Gemini API密钥',
    configuredKey: '已配置密钥：{key}',
    noApiKey: '未配置API密钥。在下方输入Gemini密钥以启用收据扫描。',
    geminiDesc: '提供您的Google Gemini API密钥以启用OCR和通过Gemini 3.5 Flash进行费用分类。',
    geminiKeyLabel: 'Gemini API密钥',
    getKey: '获取免费Gemini API密钥 ↗',
    saveKey: '保存密钥',
    saving: '保存中…',
    keySaved: 'Gemini API密钥保存成功',
    enterValidKey: '请输入有效的Gemini API密钥',
    failedSaveKey: '保存API密钥失败',
    hide: '隐藏',
    show: '显示',
  },
};

// Category keys (used as identifiers) mapped to their translation keys
export const CATEGORY_KEYS = [
  'groceries',
  'diningOut',
  'utilities',
  'housing',
  'transportation',
  'entertainment',
  'shopping',
  'healthcare',
  'personalCare',
  'furniture',
  'luxury',
  'alcoholDrinks',
  'education',
  'travel',
  'subscriptions',
  'insurance',
  'gifts',
  'discounts',
  'other',
];

// English category values (used as the actual DB values sent to backend)
export const CATEGORY_VALUES_EN = CATEGORY_KEYS.map(k => translations.en[k]);

export function getTranslator(lang) {
  const dict = translations[lang] || translations.en;
  return function t(key, params) {
    let str = dict[key] ?? translations.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
      }
    }
    return str;
  };
}

export function getCategoryOptions(lang) {
  const dict = translations[lang] || translations.en;
  return CATEGORY_KEYS.map(k => ({
    key: k,
    value: translations.en[k],   // always store English value in DB
    label: dict[k] || translations.en[k],  // display in current language
  }));
}

export default translations;
