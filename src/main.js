/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  // @TODO: Расчет выручки от операции
  // purchase — это одна из записей в поле items из чека в data.purchase_records
  // _product — это продукт из коллекции data.products
  const { discount = 0, sale_price, quantity } = purchase;
  const discountFactor = 1 - discount / 100;
  return sale_price * quantity * discountFactor;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  let coef = 0.05; // По умолчанию 5%

  if (index === 0) {
    coef = 0.15; // 15% для первого
  } else if (index === 1 || index === 2) {
    coef = 0.1; // 10% для 2-го и 3-го
  } else if (index === total - 1) {
    coef = 0; // 0% для последнего
  }

  // ВАЖНО: Тест ожидает итоговую сумму.
  // Берем прибыль из объекта seller и умножаем на коэффициент.
  const profit = seller.profit || 0;
  return profit * coef;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных
  if (!data) {
    throw new Error('Данные отсутствуют');
  }

  if (!Array.isArray(data.sellers) || data.sellers.length === 0) {
    throw new Error('Продавцы должны быть непустым массивом');
  }

  if (!Array.isArray(data.products) || data.products.length === 0) {
    throw new Error('Товары должны быть непустым массивом');
  }

  if (
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  ) {
    throw new Error('Чеки должны быть непустым массивом');
  }

  // Проверка наличия опций
  if (typeof options !== 'object' || options === null) {
    throw new Error('Опции должны быть объектом');
  }

  const { calculateRevenue, calculateBonus } = options;

  if (typeof calculateRevenue !== 'function') {
    throw new Error('calculateRevenue должна быть функцией');
  }

  if (typeof calculateBonus !== 'function') {
    throw new Error('calculateBonus должна быть функцией');
  }

  // Подготовка промежуточных данных для сбора статистики
  const sellerStats = data.sellers.map((seller) => ({
    seller_id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    sales_count: 0,
    revenue: 0,
    profit: 0,
    bonus: 0,
    top_products: [],
    products_sold: {},
  }));

  // Индексация продавцов и товаров для быстрого доступа
  const sellerIndex = sellerStats.reduce(
    (result, seller) => ({
      ...result,
      [seller.seller_id]: seller,
    }),
    {},
  );

  const productIndex = data.products.reduce(
    (result, product) => ({
      ...result,
      [product.sku]: product,
    }),
    {},
  );

  // Расчет выручки и прибыли для каждого продавца
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) {
      console.warn('Seller not found:', record.seller_id);
      return;
    }
    seller.sales_count += 1;

    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (!product) {
        console.warn('Product not found:', item.sku);
        return;
      }

      // Посчитаем себестоимость товара
      const cost = product.purchase_price * item.quantity;

      // Посчитаем выручку с учётом скидки
      const revenue = calculateRevenue(item, product);

      // Посчитаем прибыль
      const profit = revenue - cost;

      // Увеличиваем общую накопленную прибыль продавца
      seller.profit += profit;

      // Учитываем количество проданных товаров
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });

    // Увеличить общую сумму выручки продавца на сумму чека (total_amount)
    const total = Number(record.total_amount) || 0;
    seller.revenue += total;
  });
  // Сортировка продавцов по прибыли (убывание) — защищённо от undefined/NaN
  sellerStats.sort((a, b) => (Number(b.profit) || 0) - (Number(a.profit) || 0));

  // Назначение премий на основе ранжирования и формирование топ-10 продуктов
  const totalSellers = sellerStats.length;
  sellerStats.forEach((seller, index) => {
    // Получаем коэффициент бонуса от переданной функции calculateBonus
    const bonusAmount = calculateBonus(index, totalSellers, seller);

    // Бонус начисляем как процент от положительной прибыли
    const profitValue = Math.max(0, Number(seller.profit) || 0);
    seller.bonus = Number((Number(bonusAmount) || 0).toFixed(2));
    seller.bonus = Number(bonusAmount.toFixed(2));

    // Формируем топ-10 проданных товаров: [{sku, quantity}]
    const sold = seller.products_sold || {};
    seller.top_products = Object.entries(sold)
      .map(([sku, qty]) => ({ sku, quantity: qty }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // @TODO: Подготовка итоговой коллекции с нужными полями // Сюда передадим функции для расчётов

  // Здесь посчитаем промежуточные данные и отсортируем продавцов

  // Вызовем функцию расчёта бонуса для каждого продавца в отсортированном массиве

  // Сформируем и вернём отчёт
  return sellerStats.map((seller) => ({
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: +(Number(seller.revenue) || 0).toFixed(2),
    profit: +(Number(seller.profit) || 0).toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +(Number(seller.bonus) || 0).toFixed(2),
  }));
}
