import Integration from './../Integration.js';
import deleteProperty from './../functions/deleteProperty.js';

function getProductCategory(product) {
  let category = product.category;
  if (Array.isArray(category)) {
    category = category.join('/');
  } else if (category && product.subcategory) {
    category = category + '/' + product.subcategory;
  }
  return category;
}

function getProductId(product) {
  return product.id || product.skuCode || undefined;
}

function getProduct(product, quantity) {
  const yaProduct = {};
  const id = getProductId(product);
  const brand = product.brand || product.manufacturer;
  const price = product.unitSalePrice || product.unitPrice;
  const category = getProductCategory(product);
  if (id) yaProduct.id = id;
  if (product.name) yaProduct.name = product.name;
  if (brand) yaProduct.brand = brand;
  if (price) yaProduct.price = price;
  if (category) yaProduct.category = category;
  if (product.variant) yaProduct.variant = product.variant;
  if (product.voucher) yaProduct.coupon = product.voucher;
  if (quantity) yaProduct.quantity = quantity;
  return yaProduct;
}

class YandexMetrica extends Integration {

  constructor(digitalData, options) {
    const optionsWithDefaults = Object.assign({
      counterId: '',
      clickmap: false,
      webvisor: false,
      trackLinks: true,
      trackHash: false,
      purchaseGoalId: undefined,
      goals: {},
      noConflict: false,
    }, options);

    super(digitalData, optionsWithDefaults);

    this.addTag({
      type: 'script',
      attr: {
        src: '//mc.yandex.ru/metrika/watch.js',
      },
    });
  }

  getEnrichableEventProps(event) {
    let enrichableProps = [];
    switch (event.name) {
    case 'Viewed Product Detail':
      enrichableProps = [
        'product',
      ];
      break;
    case 'Completed Transaction':
      enrichableProps = [
        'transaction',
      ];
      break;
    default:
      // do nothing
    }
    return enrichableProps;
  }

  initialize() {
    const id = this.getOption('counterId');

    window.yandex_metrika_callbacks = window.yandex_metrika_callbacks || [];
    this.dataLayer = window.dataLayer = window.dataLayer || [];
    if (!this.getOption('noConflict') && id) {
      window.yandex_metrika_callbacks.push(() => {
        this.yaCounter = window['yaCounter' + id] = new window.Ya.Metrika({
          id,
          clickmap: this.getOption('clickmap'),
          webvisor: this.getOption('webvisor'),
          trackLinks: this.getOption('trackLinks'),
          trackHash: this.getOption('trackHash'),
          ecommerce: true,
        });
      });
      this.load(this.onLoad);
    } else {
      this.onLoad();
    }
  }

  isLoaded() {
    return !!(window.Ya && window.Ya.Metrika);
  }

  reset() {
    deleteProperty(window, 'Ya');
    deleteProperty(window, 'yandex_metrika_callbacks');
    deleteProperty(window, 'dataLayer');
  }

  trackEvent(event) {
    const methods = {
      'Viewed Product Detail': 'onViewedProductDetail',
      'Added Product': 'onAddedProduct',
      'Removed Product': 'onRemovedProduct',
      'Completed Transaction': 'onCompletedTransaction',
    };
    if (this.getOption('counterId')) {
      const method = methods[event.name];
      if (method && !this.getOption('noConflict')) {
        this[method](event);
      }

      const goals = this.getOption('goals');
      const goalIdentificator = goals[event.name];
      if (goalIdentificator) {
        this.yaCounter.reachGoal(goalIdentificator);
      }
    }
  }

  onViewedProductDetail(event) {
    const product = event.product;
    if (!getProductId(product) && !product.name) return;
    this.dataLayer.push({
      ecommerce: {
        detail: {
          products: [ getProduct(product) ],
        },
      },
    });
  }

  onAddedProduct(event) {
    const product = event.product;
    if (!getProductId(product) && !product.name) return;
    const quantity = event.quantity || 1;
    this.dataLayer.push({
      ecommerce: {
        add: {
          products: [ getProduct(product, quantity) ],
        },
      },
    });
  }

  onRemovedProduct(event) {
    const product = event.product;
    if (!getProductId(product) && !product.name) return;
    const quantity = event.quantity;
    this.dataLayer.push({
      ecommerce: {
        remove: {
          products: [
            {
              id: getProductId(product),
              name: product.name,
              category: getProductCategory(product),
              quantity: quantity,
            },
          ],
        },
      },
    });
  }

  onCompletedTransaction(event) {
    const transaction = event.transaction;
    if (!transaction.orderId) return;

    const products = transaction.lineItems.filter((lineItem) => {
      const product = lineItem.product;
      return (getProductId(product) || product.name);
    }).map((lineItem) => {
      const product = lineItem.product;
      const quantity = lineItem.quantity || 1;
      return getProduct(product, quantity);
    });
    const purchase = {
      actionField: {
        id: transaction.orderId,
        goal_id: this.getOption('purchaseGoalId'),
      },
      products,
    };

    if (transaction.vouchers && transaction.vouchers.length) {
      purchase.actionField.coupon = transaction.vouchers[0];
    }

    if (transaction.total) {
      purchase.actionField.revenue = transaction.total;
    } else if (transaction.subtotal) {
      purchase.actionField.revenue = transaction.subtotal;
    }

    this.dataLayer.push({
      ecommerce: { purchase },
    });
  }
}

export default YandexMetrica;
