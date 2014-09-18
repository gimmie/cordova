var _gmus = window._.noConflict();
var Gimmie = function(options) {

  // Gimmie Models
  var RemoteObject = function (data) {
    for (var key in data) {
      this[key] = data[key];
    }
  }
  // - RemoteObject
  var Reward = function (data) {
    RemoteObject.call(this, data);
    var self = this;

    this.isExpired = function () {
      return new Date().getTime() > new Date(this.valid_until).getTime();
    }

    this.isAvailable = function () {
      return this.claimed_quantity < this.total_quantity || this.total_quantity < 0;
    }

    this.isSoldout = function () {
      return !this.isAvailable();
    }

    this.isAvailableInCountry = function (countryCode) {
      if (_gmus.contains(this.country_codes, 'global')) return true;
      return _gmus.contains(this.country_codes, countryCode === 'global' ? 'global' : countryCode.toUpperCase());
    }

    this.getClaimURL = function (name, email) {
      var url = this.url;
      if (url) {
        url = url.replace(/&email=EMAIL/, '').replace(/&name=NAME/, '');
        if (name) {
          url += '&name=' + name;
        }
        if (email) {
          url += '&email=' + email;
        }
      }
      return url;
    }
    this.formatClaimURL = function () {
      return function (val) {
        var parameters = val.split(',');
        return self.getClaimURL.apply(self, parameters);
      }
    }

    this.valid_until = moment(this.valid_until, 'YYYY-MM-DDTHH:mm:ssZ');
    this.formatValidUntil = function () {
      return function (val) {
        return self.valid_until.format(val);
      }
    }
  }
  Reward.prototype = new RemoteObject;
  // - Reward

  var Claim = function (data) {
    RemoteObject.call(this, data);
    var self = this;

    this.reward = new Reward(this.reward);

    this.created_at = moment(this.created_at, 'YYYY-MM-DDTHH:mm:ssZ');
    this.formatCreatedAt = function () {
      return function (val) {
        return self.created_at.format(val);
      }
    }
  }
  Claim.prototype = new RemoteObject;
  // - Claim

  var Category = function (data) {
    RemoteObject.call(this, data);

    var _map = {};

    for (var i = 0; i < this.rewards.length; i++) {
      var reward = new Reward(this.rewards[i]);
      this.rewards[i] = reward;
      _map[reward.id] = reward;
    }

    this.getReward = function (id) {
      return _map[parseInt(id)];
    }

    this.allRewards = function (countryCode) {
      countryCode = countryCode || options.country || 'global';

      var rewards = _gmus.filter(this.rewards, function (reward) {
        return reward.isAvailableInCountry(countryCode);
      });

      return rewards;
    }

    this.availableRewards = function (countryCode) {
      var rewards = this.allRewards(countryCode);
      return _gmus.filter(rewards, function (reward) {
        return !reward.isExpired() && reward.isAvailable();
      });
    }

    this.redeemableRewards = function (user, countryCode) {
      var rewards = this.availableRewards(countryCode);
      return _gmus.filter(rewards, function (reward) {
        return user.profile.currentPoints > reward.points;
      });
    }
  }
  Category.prototype = new RemoteObject;
  // - Category

  var BadgeCategory = function (name, badges) {
    this.name = name;
    this.badges = badges;
    for (var i = 0; i < badges.length; i++) {
      this.badges[i] = new Badge(badges[i]);
    }
  }
  // - BadgeCategory

  var Tier = function (data) {
    RemoteObject.call(this, data);

    this.progress = function () {
      var _progress = -1;
      if (data.rule_description && data.rule_description.or) {
        var or = _gmus.map(data.rule_description.or, function (orRule) {
          var and = orRule.and;
          var progresses = _gmus.map(and, function (andRule) {
            var progress = andRule.progress > andRule.at_least ? 1 : andRule.progress / andRule.at_least;
            return progress;
          });
          return _gmus.reduce(progresses, function (sum, num) { return sum + num; }) / progresses.length;
        });

        _progress = _gmus.max(or);
      }
      // rule_description
      return _progress;
    }

    this.haveProgress = isFinite(this.progress());
  }
  Tier.prototype = new RemoteObject;
  // - Tier

  var Badge = function (tiers) {
    this.tiers = tiers;
    this.firstTier = new Tier(tiers[0]);

    for (var i = 0; i < tiers.length; i++) {
      this.tiers[i] = new Tier(tiers[i]);
    }

    this.unlockedTier = function (profile) {
      var targetBadge = null;

      var unlockedBadges = _gmus.map(profile.badges, function (badge) {
        return badge.id;
      });
      var localTiers = _gmus.map(tiers, function (tier) {
        return tier.id;
      });

      var intersectBadges = _gmus.intersection(unlockedBadges, localTiers);
      if (intersectBadges.length > 0) {
        targetBadge = _gmus.filter(tiers, function (tier) {
          return _gmus.contains(intersectBadges, tier.id)
        })[intersectBadges.length - 1];
      }

      return targetBadge;
    }

  }
  // - Badge

  var Badges = function (data) {
    var _categories = [];
    this.categories = {};
    for (var key in data) {
      var category = new BadgeCategory(key, data[key]);
      this.categories[key] = category;
      _categories.push (category);
    }

    this.allBadges = function (profile) {
      var _badges = [];
      for (var i = 0; i < _categories.length; i++) {
        var category = _categories[i];
        var badges = category.badges;
        for (var j = 0; j < badges.length; j++) {
          _badges.push(badges[j]);
        }
      }

      _badges.sort(function (first, second) {
        var firstUnlockedTier = first.unlockedTier(profile);
        var secondUnlockedTier = second.unlockedTier(profile);
        if (firstUnlockedTier && secondUnlockedTier) {
          return 0
        }
        else if (firstUnlockedTier && !secondUnlockedTier) {
          return -1;
        }
        else {
          return 1;
        }
      });

      return _badges;
    }
  }
  // - Badges

  var RecentActivity = function (data) {
    RemoteObject.call(this, data);

    this.icon = 'activity-point.png';
    if (this.type === 'action') {
      if (this.detail && this.detail.action_type && this.detail.action_type === 'Instant Reward') {
        this.detail.claim = new Claim(this.detail.claim);
        this.icon = 'activity-reward.png';
      }
    }
    else if (this.type === 'claim') {
      this.detail = new Claim(this.detail);
      this.icon = 'activity-reward.png';
    }
    else if (this.type === 'badge') {
      this.icon = 'activity-badge.png';
    }
    else if (this.type === 'level') {
      this.icon = 'activity-levelup.png';
    }

    this.moment = moment(new Date(this.created_at * 1000)).fromNow();
  }
  RecentActivity.prototype = new RemoteObject;
  // - Recent Activity

  var Profile = function (data) {
    RemoteObject.call(this, data);

    this.currentPoints = this.user.awarded_points - this.user.redeemed_points;
    this.currentProgress = (this.user.awarded_points - this.user.current_level_points)/(this.user.next_level_points - this.user.current_level_points)*100;
    this.nextLevel = this.user.current_level + 1;
    this.isLevelEnable = this.user.current_level > 1 || this.user.next_level_points;
    this.reachedHighestLevel = this.user.current_level > 1 && !this.user.next_level_points;

    for (var i = 0; i < this.claims.length; i++) {
      this.claims[i] = new Claim(this.claims[i]);
    }
    var _claims = this.claims.reverse();
    var expiredRewards = _gmus.filter(_claims, function (claim) { return claim.reward.isExpired(); });
    var nonExpiredRewards = _gmus.filter(_claims, function (claim) { return !claim.reward.isExpired(); });

    this.claims = nonExpiredRewards.concat(expiredRewards);

  }
  Profile.prototype = new RemoteObject;
  // - Gimmie Models


  var self = this;
  this.remote = new Remote(options);
  this.options = options;

  var listeners = {};

  this.addListener = function (name, cb) {
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(cb);
  }

  this.notify = function (name, data) {
    var callbacks = listeners[name];
    _gmus.each(callbacks, function (callback) {
      callback(data);
    });
  }

  this.getProfile = function(fresh, callback) {
    callback = callback || function () {};

    // Force fresh profile if name in gimmie option doesn't match in storage.
    var optionUser = self.options.user;
    if (optionUser && window.localStorage) {
      var previousValue = localStorage.getItem('gimmie-option-user');
      if (previousValue !== optionUser.name) {
        fresh = true;
      }

      localStorage.setItem('gimmie-option-user', optionUser.name);
    }

    var returnFromLocal = false;
    if (window.localStorage && window.localStorage.getItem('user') && !fresh) {
      returnFromLocal = true;
      var cache = JSON.parse(localStorage.getItem('user'));
      cache.response = new Profile(cache.response);
      callback(cache);
    }
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'profile', {}, function (data) {
      var response = data.response;
      if (response.success && response.user.user_id != null) {
        if (window.localStorage) {
          localStorage.setItem('user', JSON.stringify(data));
        }
        data.response = new Profile(response);
      }
      else {
        if (window.localStorage) {
          delete localStorage['user'];
        }
      }

      if (!returnFromLocal) {
        callback(data);
      }

      setTimeout(function () {
        self.notify(Gimmie.Events.PROFILE_UPDATE, data);
      }, 1000);
    });
  };

  this.triggerShare = function(service, callback) {
    callback = callback || function () {};
    var self = this;
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'trigger', {
      event_name: service,
      source_uid: document.URL
    }, function (data) {
      self.notify(Gimmie.Events.TRIGGER_EVENT, data);
      callback(data);
    });
  };

  this.checkin = function (id, venue, callback) {
    callback = callback || function () {};
    var self = this;
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'check_in/' + id, {
      venue: venue
    }, function (data) {
      self.notify(Gimmie.Events.CHECKIN, data);
      callback(data);
    });
  }

  this.triggerEvent = function(eventname, callback) {
    callback = callback || function () {};
    var self = this;
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'trigger', {
      event_name: eventname
    }, function (data) {
      self.notify(Gimmie.Events.TRIGGER_EVENT, data);
      callback(data);
    });
  };

  this.triggerUniqueEvent = function(eventname, uniqueid, callback) {
    callback = callback || function () {};
    var self = this;
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'trigger', {
      source_uid: uniqueid,
      event_name: eventname
    }, function (data) {
      self.notify(Gimmie.Events.TRIGGER_EVENT, data);
      callback(data);
    });
  };

  this.redeem = function(rewardid, callback) {
    if (callback) {
      self.remote.fetch(Remote.Type.OAUTH_JSONP, 'redeem', {
        reward_id: rewardid
      }, function (data) {
        if (data.response.success) {
          data.response.claim = new Claim(data.response.claim);
        }
        callback(data);
      });
    }
    else {
      var data = self.remote.fetch(Remote.Type.SYNC_XHR, 'redeem', {
        reward_id: rewardid
      });
      if (data.response.success) {
        data.response.claim = new Claim(data.response.claim);
      }
      return data;
    }
  };

  this.loadReward = function(rewardid, callback) {
    self.remote.fetch(Remote.Type.JSONP, 'rewards', {
      reward_id: rewardid
    }, callback);
  };

  this.loadClaim = function(claimid, callback) {
    self.remote.fetch(Remote.Type.OAUTH_JSONP,'claims', {
      claim_id: claimid
    }, callback);
  };

  this.loadEvents = function(eventsid, callback) {
    var parameters = eventsid.join();
    self.remote.fetch(Remote.Type.JSONP, 'events', {
      event_id: parameters
    }, callback);
  };

  this.loadActions = function(callback) {
    callback = callback || function () {};
    var self = this;
    self.remote.fetch(Remote.Type.OAUTH_JSONP,'recent_actions', null, function (data) {
      self.notify(Gimmie.Events.LOAD_ACTIONS, data);
      callback(data);
    });

  };

  this.loadActivities = function (callback) {
    callback = callback || function () {};
    var self = this;
    self.remote.fetch(Remote.Type.OAUTH_JSONP,'recent_activities', null, function (data) {
      if (data.response.success) {
        for (var i = 0; i < data.response.recent_activities.length; i++) {
          var activity = new RecentActivity(data.response.recent_activities[i]);
          data.response.recent_activities[i] = activity;
        }
      }

      self.notify(Gimmie.Events.LOAD_ACTIVITIES, data);
      callback(data);
    });
  };

  this.loadCategories = function (callback) {
    self.remote.fetch(Remote.Type.JSONP, 'categories', null,
      function (data) {
        if (data.response.success) {
          var categories = data.response.categories || [];
          for (var i = 0; i < categories.length; i++) {
            var category = new Category(categories[i]);
            categories[i] = category;
          }
        }
        callback(data);
      });
  };

  this.top20 = function (orderBy, callback) {
    self.remote.fetch(Remote.Type.JSONP, 'top20' + orderBy, null, callback);
  };

  this.loadBadgesRecipe = function (isShowProgress, callback) {
    var parameters = {}
    if (isShowProgress) {
      parameters['progress'] = 1;
    }
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'badges', parameters, function (data) {
      if (data.response.success) {
        data.response.badges = new Badges(data.response.badges);
      }
      callback(data);
    });
  }

  this.notificationToken = function (callback) {
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'notification_token', null, callback);
  }

  this.login = function (oldID, callback) {
    var parameters = null;
    if (oldID) {
      parameters = { old_uid: oldID };
    }
    self.remote.fetch(Remote.Type.OAUTH_JSONP, 'login', parameters, callback);
  }
};

Gimmie.LeaderBoard = {
  ORDER_BY_POINTS: 'points',
  ORDER_BY_REWARD_PRICE: 'prices',
  ORDER_BY_REDEMTIONS_COUNT: 'redemtions_count'
};

Gimmie.Events = {
  PROFILE_UPDATE: 'profile_update',
  TRIGGER_EVENT: 'trigger_event',
  CHECKIN: 'checkin',
  LOAD_ACTIONS: 'load_actions',
  LOAD_ACTIVITIES: 'load_activities'
}

var Remote = function (options) {

  var JSONPCallbackFunctionName = "GimmieJSONPCallback";

  var self = this;
  self.options = options;

  this.fetch = function (type, action, parameters, callback) {
    var fn = self['_' + type];
    if (fn) {
      callback = callback || function () {};

      parameters = parameters || {};
	    //Add country and locale
	    parameters.country = self.options.country || '';
	    parameters.locale = self.options.locale || '';
      parameters.ord = Math.random()*10000000000000000;
      parameters.ua = 'widget 2.0';

      return fn.call(self, action, parameters, callback);
    }
    else {
      throw new Error('Invalid remote type');
    }
  }

  this._xhr = function (action, parameters, callback) {
    return self.__xhr(action, parameters, true, callback);
  }

  this._syncxhr = function (action, parameters) {
    return self.__xhr(action, parameters, false);
  }

  this.__xhr = function (action, parameters, isAsynchronous, callback) {
    if (!self.options.endpoint) {
      throw new Error('This api requires secure endpoint.');
    }

    var url = self.options.endpoint + '/1/' + action + '.json?';
    url += self._serializeParameters(parameters);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, isAsynchronous);
    if (!isAsynchronous) {
      xhr.send();
      if (xhr.readyState == 4 && xhr.status == 200) {
        return JSON.parse(xhr.responseText);
      }
      else {
        return null;
      }
    }
    else {
      xhr.onreadystatechange = function (e) {
        if (this.readyState == 4 && this.status == 200) {
          var text = this.responseText.replace(/^\s+|\s+$/,'');
          if (text) {
            callback(JSON.parse(text));
          }
        }
      }
      xhr.send();
    }
  }

  this._jsonp = function (action, parameters, callback) {
    // This end point is for methods that doesn't need hidden player information,
    // So it can call to Gimmie directly without secret key. #538 and #540
    var endpoint = self.options.gimmie_endpoint || 'https://api.gimmieworld.com';
    parameters.oauth_consumer_key = self.options.key || '';

    var url = endpoint + '/1/' + action + '.json?callback=' + JSONPCallbackFunctionName + '&';
    url += self._serializeParameters(parameters);

    self.__jsonp(url, callback);
  }

  this._oauth_jsonp = function (action, parameters, callback) {
    var endpoint = self.options.gimmie_endpoint || 'https://api.gimmieworld.com';

    if (!self.options.secret && !self.options.user) {
      return self._oauth_jsonp(action, parameters, callback);
    }

    var url = self._signedRequest(
      self.options.key, 
      self.options.secret, 
      self.options.user.external_uid,
      endpoint + '/1/' + action + '.json?callback=' + JSONPCallbackFunctionName + '&' + self._serializeParameters(parameters)
    );

    self.__jsonp(url, callback);

  }

  this.__jsonp = function (url, callback) {
    window[JSONPCallbackFunctionName] = function (data) {
      var headElement = document.getElementsByTagName('head')[0];
      var element = document.getElementById('gimmie-jsonp');
      headElement.removeChild(element);

      var validJSON = false;
      if (typeof data == "string") {
        try {validJSON = JSON.parse(data);} catch (e) {/*invalid JSON*/}
      } else {
        validJSON = JSON.parse(JSON.stringify(data));
      }

      if (validJSON) {
        callback(validJSON);
      } else {
        throw("JSONP call returned invalid or empty JSON");
      }
    }

    var scriptTag = document.createElement('script');
    scriptTag.type = 'text/javascript';
    scriptTag.src = url;
    scriptTag.id = 'gimmie-jsonp';
    document.getElementsByTagName('head')[0].appendChild(scriptTag);
  }

  this._serializeParameters = function (parameters) {
    var input = '';
    for (var key in parameters) {
      input += key + '=' + parameters[key] + '&';
    }

    if (input.lastIndexOf('&') == input.length - 1) {
      input = input.substring(0, input.length - 1);
    }
    return input;
  }

  this._signedRequest = function (key, secret, user, url) {
    var accessor = { consumerSecret: secret, tokenSecret: secret };
    var message = { action: url, method: "GET", parameters: [["oauth_version","1.0"],["oauth_consumer_key", key],["oauth_token", user]]};
  
    OAuth.setTimestampAndNonce(message);
    OAuth.SignatureMethod.sign(message, accessor);
  
    var parameterMap = OAuth.getParameterMap(message);
    var baseStr = OAuth.decodeForm(OAuth.SignatureMethod.getBaseString(message));
    var theSig = "";
  
    if (parameterMap.parameters) {
      for (var item in parameterMap.parameters) {
        for (var subitem in parameterMap.parameters[item]) {
          if (parameterMap.parameters[item][subitem] == "oauth_signature") {
            theSig = parameterMap.parameters[item][1];
            break;
          }
        }
      }
    }
  
    var paramList = baseStr[2][0].split("&");
    paramList.push("oauth_signature="+ encodeURIComponent(theSig));
    paramList.sort(function(a,b) {
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      if (a[1] < b[1]) return  -1;
      if (a[1] > b[1]) return 1;
      return 0;
    });
  
    var locString = "";
    for (var x in paramList) {
      locString += paramList[x] + "&";
    }
  
    var finalStr = baseStr[1][0] + "?" + locString.slice(0,locString.length - 1);
  
    return finalStr;
  }

}

Remote.Type = {
  XHR: 'jsonp',
  SYNC_XHR: 'syncxhr',
  JSONP: 'jsonp',
  OAUTH_JSONP: 'oauth_jsonp'
}
