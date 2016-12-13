import Integration from './../Integration.js';

// insert script after the last script of a document
function insertLast(script) {
  let scripts = document.getElementsByTagName('script');
  let last = scripts[scripts.length-1];
  last.parentNode.insertBefore(script, last.nextSibling);
}

// create script from its listing (string)
function createScript(code) {
  let script = document.createElement("script");
  script.type = "text/javascript";
  script.innerText = code;
  return script;
}

// represent array of strings as a string (with brackets)
function stringifyArray(array) {
  return "[ " + array.map((elem) => {
      return `"${elem}"`;
    }).join() + " ]";
}

// represent products (LineItem) array as a string
function stringifyProducts(items) {
  return "[ " + items.map((item) => {
    return `{
        identifier: "${item.product.id}",
        amount: ${item.product.unitSalePrice},
        currency: ${item.product.currency},
        quantity: ${item.quantity}
      }`;
  }).join() + " ]";
}

class Sociomantic extends Integration {

  constructor(digitalData, options) {
    const optionsWithDefaults = Object.assign({
      token: 'aizel-ru',
    }, options);

    super(digitalData, optionsWithDefaults);

    this.addTag({
      type: 'script',
      attr: {
        src: `//eu-sonar.sociomantic.com/js/2010-07-01/adpan/${options.token}`,
      },
    });
  }

  initialize() {
    this._isLoaded = true;
    this.onLoad();
  }

  isLoaded() {
    return this._isLoaded;
  }

  reset() {
    // nothing to reset
  }

  trackEvent(event) {
    if (event.name === 'Viewed Page') {
      this.onViewedPage(event.page);
    } else if (event.name === 'Viewed Product') {
      this.onViewedProduct(event.listItems);
    } else if (event.name === 'Searched') {
      this.onSearched(event.listing);
    } else if (event.name === 'Viewed Cart') {
      this.onViewedCart(event.product, event.cart.lineItems);
    } else if (event.name === 'Completed Transaction') {
      this.onCompletedTransaction(event.transaction);
    }
  }

  onViewedPage(page) {
    let breadcrumb = stringifyArray(page.breadcrumb);

    let code = `var product = {
      category: ${breadcrumb}
    };`;

    this.addIntegrationCode(code);
  }

  onViewedProduct(items) {
    if (items.length < 1) return;
    let product = Array.isArray(items[0].product) ? null : items[0].product;
    if (product == null) return;

    let params = [];
    params.push(`identifier: "${product.id}"`);
    params.push(`fn: "${product.name}"`);
    params.push(`price: "${product.unitSalePrice}"`);
    params.push(`currency: "${product.currency}"`);
    let category = stringifyArray(product.category);
    params.push(`category: "${category}"`);

    if (product.hasOwnProperty("stock")) {
      params.push(`quantity: "${product.stock}"`);
    }
    if (product.hasOwnProperty("description")) {
      params.push(`description: "${product.description}"`);
    }
    if (product.hasOwnProperty("manufacturer")) {
      params.push(`brand: "${product.manufacturer}"`);
    }
    if (product.hasOwnProperty("url")) {
      params.push(`url: "${product.url}"`);
    }
    if (product.hasOwnProperty("imageUrl")) {
      params.push(`photo: "${product.imageUrl}"`);
    }

    params = params.join();

    let code = `var product = {
      ${params}
    };`;

    this.addIntegrationCode(code);
  }

  onSearched(listing) {
    if (!listing.hasOwnProperty("query")) return;

    let code = `var search = {
      type: 1,
      query: ${listing.query}
    };`;

    this.addIntegrationCode(code);
  }

  onViewedCart(items) {
    let products = stringifyProducts(items);

    let code = `var basket = {
      products: ${products}
    };`;

    this.addIntegrationCode(code);
  }

  onCompletedTransaction(transaction) {
    let products = stringifyProducts(transaction.lineItems);

    let code = `var basket = {
      products: ${products},
      transaction: "${transaction.orderId}",
      amount: ${transaction.total},
      currency: ${transaction.currency}
    };`;

    this.addIntegrationCode(code);
  }

  // add two scripts:
  // first with data for the integration (e.g. product info)
  // second -- provided by Sociomantic
  addIntegrationCode(dataScript) {
    insertLast(createScript(dataScript));

    let sociomanticScript = document.createElement('script');
    sociomanticScript.type = 'text/javascript';
    sociomanticScript.async = true;
    sociomanticScript.src = ('https:' == document.location.protocol ? 'https:' : 'http:') + this.getTag().attr.src;
    insertLast(sociomanticScript);
  }
}

export default Sociomantic;

