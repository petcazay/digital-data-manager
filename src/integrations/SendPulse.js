import Integration from './../Integration.js';
import deleteProperty from './../functions/deleteProperty.js';
import { getProp } from './../functions/dotProp';
import type from 'component-type';

class SendPulse extends Integration {

  constructor(digitalData, options) {
    const optionsWithDefaults = Object.assign({
      https: false,
      pushScriptUrl: '',
      pushSubscriptionTriggerEvent: 'Agreed to Receive Push Notifications',
      userVariables: [],
    }, options);

    super(digitalData, optionsWithDefaults);

    this.addTag({
      type: 'script',
      attr: {
        charset: 'UTF-8',
        src: this.getOption('pushScriptUrl'),
      },
    });
  }

  initialize() {
    this.load(() => {
      const original = window.oSpP.storeSubscription;
      window.oSpP.storeSubscription = (value) => {
        original(value);
        if (value !== 'DENY') {
          this.digitalData.user.pushNotifications.isSubscribed = true;
          this.sendUserAttributes(this.digitalData);
        }
      };
      this.onLoad();
    });
  }

  enrichDigitalData() {
    const pushNotification = this.digitalData.user.pushNotifications = {};
    try {
      pushNotification.isSupported = this.checkPushNotificationsSupport();
      this.getPushSubscriptionInfo((subscriptionInfo) => {
        if (!this.isLoaded()) {
          // to avoid problems in unit tests because of asyncoronous delay
          return;
        }
        if (subscriptionInfo === undefined) {
          pushNotification.isSubscribed = false;
          if (window.oSpP.isSafariNotificationSupported()) {
            const info = window.safari.pushNotification.permission('web.com.sendpulse.push');
            if (info.permission === 'denied') {
              pushNotification.isDenied = true;
            }
          }
        } else {
          if (subscriptionInfo.value === 'DENY') {
            pushNotification.isSubscribed = false;
            pushNotification.isDenied = true;
          } else {
            pushNotification.isSubscribed = true;
            pushNotification.subscriptionId = subscriptionInfo.value;
          }
        }
        this.onSubscriptionStatusReceived();
        this.onEnrich();
      });
    } catch (e) {
      pushNotification.isSupported = false;
      this.onEnrich();
    }
  }

  onSubscriptionStatusReceived() {
    if (this.digitalData.user.pushNotifications.isSubscribed) {
      this.sendUserAttributes(this.digitalData);
    }
  }

  checkPushNotificationsSupport() {
    const oSpP = window.oSpP;

    if (!oSpP.detectSite()) {
      return false;
    }
    if (oSpP.detectOs() === 'iOS') {
      return false;
    }
    const os = oSpP.detectOs();
    const browserInfo = oSpP.detectBrowser();
    const browserName = browserInfo.name.toLowerCase();
    if ((browserName === 'chrome') && (parseFloat(browserInfo.version) < 42)) {
      return false;
    }
    if ((browserName === 'firefox') && (parseFloat(browserInfo.version) < 44)) {
      return false;
    }
    if ((browserName === 'firefox') && (os === 'Android')) {
      return false;
    }
    if (['safari', 'firefox', 'chrome'].indexOf(browserName) < 0) {
      return false;
    }
    if (browserName === 'safari') {
      return oSpP.isSafariNotificationSupported();
    } else if (this.isHttps()) {
      return oSpP.isServiceWorkerChromeSupported();
    }

    return true;
  }

  getPushSubscriptionInfo(callback) {
    const oSpP = window.oSpP;
    oSpP.getDbValue('SPIDs', 'SubscriptionId', (event) => {
      callback(event.target.result);
    });
  }

  sendUserAttributes(digitalData) {
    const userVariables = this.getOption('userVariables');
    for (const userVar of userVariables) {
      let value;
      if (userVar.indexOf('.') < 0) { // legacy version
        value = getProp(digitalData.user, userVar);
      } else {
        value = getProp(digitalData, userVar);
      }
      if (
        value !== undefined &&
        type(value) !== 'object'
      ) {
        window.oSpP.push(userVar, String(value));
      }
    }
  }

  isLoaded() {
    return !!(window.oSpP);
  }

  reset() {
    deleteProperty(window, 'oSpP');
  }

  isHttps() {
    return (window.location.href.indexOf('https://') === 0) && this.getOption('https') === true;
  }

  trackEvent(event) {
    if (event.name === this.getOption('pushSubscriptionTriggerEvent')) {
      if (this.checkPushNotificationsSupport()) {
        if (this.isHttps()) {
          window.oSpP.startSubscription();
        } else {
          const browserInfo = window.oSpP.detectBrowser();
          const browserName = browserInfo.name.toLowerCase();
          if (browserName === 'safari') {
            window.oSpP.startSubscription();
          } else if (browserName === 'chrome' || browserName === 'firefox') {
            window.oSpP.showPopUp();
          }
        }
      }
    }
  }
}

export default SendPulse;
