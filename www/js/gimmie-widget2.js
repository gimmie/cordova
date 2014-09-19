var Widget = function (root) {

  /*\
  |*|
  |*|  :: cookies.js ::
  |*|
  |*|  A complete cookies reader/writer framework with full unicode support.
  |*|
  |*|  https://developer.mozilla.org/en-US/docs/DOM/document.cookie
  |*|
  |*|  This framework is released under the GNU Public License, version 3 or later.
  |*|  http://www.gnu.org/licenses/gpl-3.0-standalone.html
  |*|
  |*|  Syntaxes:
  |*|
  |*|  * docCookies.setItem(name, value[, end[, path[, domain[, secure]]]])
  |*|  * docCookies.getItem(name)
  |*|  * docCookies.removeItem(name[, path], domain)
  |*|  * docCookies.hasItem(name)
  |*|  * docCookies.keys()
  |*|
  \*/

  var _docCookies = {
    getItem: function (sKey) {
      return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
    },
    setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
      if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
      var sExpires = "";
      if (vEnd) {
        switch (vEnd.constructor) {
          case Number:
            sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; max-age=" + vEnd;
            break;
          case String:
            sExpires = "; expires=" + vEnd;
            break;
          case Date:
            sExpires = "; expires=" + vEnd.toUTCString();
            break;
        }
      }
      document.cookie = encodeURIComponent(sKey) + "=" + encodeURIComponent(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
      return true;
    },
    removeItem: function (sKey, sPath, sDomain) {
      if (!sKey || !this.hasItem(sKey)) { return false; }
      document.cookie = encodeURIComponent(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + ( sDomain ? "; domain=" + sDomain : "") + ( sPath ? "; path=" + sPath : "");
      return true;
    },
    hasItem: function (sKey) {
      return (new RegExp("(?:^|;\\s*)" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
    },
    keys: /* optional method: you can safely remove it! */ function () {
      var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
      for (var nIdx = 0; nIdx < aKeys.length; nIdx++) { aKeys[nIdx] = decodeURIComponent(aKeys[nIdx]); }
      return aKeys;
    }
  };

  // Local simply jQuery version without AJAX Libs
  var _o = function (element) {
    var wrapper = function (element) {
      var _element = element;
      this.bind = function (name, fn) {
        if (!_element) return;

        // Old IE
        if (_element.attachEvent) {
          _element.attachEvent('on' + name, function (e) {
            if (!e) {
              e = window.event;
            }
            e.currentTarget = _element;
            if (!e.target) {
              e.target = e.srcElement;
            }
            fn(e);
          });
        }
        else {
          _element.addEventListener(name, fn);
        }
      }
      this.unbind = function (name, fn) {
        if (!_element) return;

        if (_element.detachEvent) {
          _element.detachEvent('on' + name, fn);
        }
        else {
          _element.removeEventListener(name, fn);
        }
      }
      this.getAttribute = function(attr) {
        if (!_element) return;

        var result = (_element.getAttribute && _element.getAttribute(attr)) || null;
        if( !result ) {
            var attrs = _element.attributes;
            var length = attrs.length;
            for(var i = 0; i < length; i++)
                if(attrs[i].nodeName === attr)
                    result = attrs[i].nodeValue;
        }
        return result;
      }
    }
    return new wrapper(element);
  }

  /**
   * Initial widget with user
   */
  this.init = function (user) {
    this._importTemplate();
    this._embedTracker();
    this._registerAllHandlers();
    this._scanComponents();
    var initInterval = setInterval(function (user) {
      if (self._loaded.css && self._loaded.template) {
        clearInterval(initInterval);

        if (user) {
          self._userWidget.call(self, user, function () {
          });

        }
        else {
          self._anonymousWidget.call(self, function () {
          });

        }
      }
    }.bind(this, user), 1000);
  }

  // Show widget for anonymous user.
  this._anonymousWidget = function (fn) {

    // TODO: Enable by default in the future.
    if (self._configuration.options.anonymous) {
      if (!_docCookies.getItem(Widget.GUEST_COOKIE)) {
        var guid = 'guest:xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-'.replace(/[xy]/g, function(c) {
          var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
          return v.toString(16);
        }) + (new Date().getTime());
        self._log (guid);
        _docCookies.setItem(Widget.GUEST_COOKIE, guid);
      }

      var guest = _docCookies.getItem(Widget.GUEST_COOKIE);
      self._user = {
        external_uid: guest,
        name: "Guest"
      };
      self.API.getProfile(false);
      self._log('Init guest user');
      var interval = setInterval(function () {
        if (!self._user.profile) {
          return;
        }

        clearInterval(interval);
        self._log(self._user);

        if (!_docCookies.getItem(Widget.GUEST_TIMEOUT)) {
          self.API.triggerUniqueEvent('view_page', document.URL);
        }

        if (self._configuration.options &&
            self._configuration.options.auto_show_notification &&
            !self._configuration.options.push_notification) {
          self.API.loadActivities(function (data) {
            self.triggerOutput(data);
          });
        }

        self._dispatch(Widget.Events.WIDGET_LOAD);
      }, 1000);

    }
    // Anonymous block
    else {
      self._dispatch(Widget.Events.WIDGET_LOAD);
    }

  }

  // Show widget for logged in user.
  this._userWidget = function (user, fn) {

    self._user = user;
    self.API.getProfile(false);
    self._log('Init user widget.');

    var interval = setInterval(function () {
      if (!self._user.profile) {
        return;
      }

      clearInterval(interval);

      self._log (self._user);
      if (self._configuration.options &&
          self._configuration.options.auto_show_notification &&
          !self._configuration.options.push_notification) {
        self.API.loadActivities(function (data) {
          self.triggerOutput(data);
        });
      }

      self._dispatch(Widget.Events.WIDGET_LOAD);
    }, 1000);

    // TODO: Check why widget keep calling this!
    if (self._configuration.options.anonymous && _docCookies.getItem(Widget.GUEST_COOKIE)) {
      var user = _docCookies.getItem(Widget.GUEST_COOKIE);
      _docCookies.removeItem(Widget.GUEST_COOKIE);
      _docCookies.setItem(Widget.GUEST_TIMEOUT, 'true', 3600);

      self.API.login(user);
    }

  }

  this._scanComponents = function () {
    var elements = document.querySelectorAll('*[gm-view]');
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      _o(element).bind('click', function (e) {
        var target = e.currentTarget;
        var page = target.getAttribute('gm-view');
        self._showPopup(page);
      });
    }
    // - elements

    function openPopup(page) {
      return function() {
        self._showPopup(page);
      }
    }

    ['catalog', 'profile', 'leaderboard'].forEach(function (page) {
      elements = document.querySelectorAll('.gm-open-' + page);
      for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        _o(element).bind('click', openPopup(page));
      }
    });
    // - incase cannot use special tag
    
    var triggers = document.querySelectorAll('*[gm-trigger]');
    for (var i = 0; i < triggers.length; i++) {
      var trigger = triggers[i];
      _o(trigger).bind('click', function (e) {
        var target = e.currentTarget;
        var event = target.getAttribute('gm-trigger');
        self.API.triggerEvent(event, function() {
          self.API.loadActivities(self.triggerOutput);
        });
      });
    }
    // - triggers
  }

  this._closePopup = function () {
    var element = document.getElementById(self._root.substring(1));
    var rootView = document.querySelector('.gimmie-fullscreen-popup');
    self._currentPage = null;
    if (rootView) {
      element.removeChild(rootView);
    }
  }

  this._isPageEnabled = function (page) {
    var options = self._configuration.options;
    if (options.pages[page] && options.pages[page].hide) {
      return false;
    }
    return true;
  }

  this._showPopup = function (page, options) {

    var configOptions = self._configuration.options;

    // Enable catalog page when these pages are enable.
    if (configOptions.pages[Widget.Pages.LEADERBOARD].most_points === false &&
        configOptions.pages[Widget.Pages.LEADERBOARD].most_rewards === false &&
        configOptions.pages[Widget.Pages.LEADERBOARD].most_reward_value === false) {
      configOptions.pages[Widget.Pages.LEADERBOARD].hide = true;
    }

    // Anonymous user can access only catalog
    if (!self._configuration.user) {
      // Don't show popup if rewards page is not enable.
      if (configOptions && configOptions.pages &&
          configOptions.pages.catalog &&
          configOptions.pages.catalog.hide) {
        return;
      }
      page = Widget.Pages.CATALOG;
    }
    else {
      var pages = [ Widget.Pages.CATALOG, Widget.Pages.PROFILE, Widget.Pages.LEADERBOARD ];

      _gmus.each(Widget.Pages, function (page) {
        if (configOptions && configOptions.pages &&
            configOptions.pages[page] &&
            configOptions.pages[page].hide) {
          pages = _gmus.without(pages, page);
        }
      });
      self._log ('Enable pages: ', pages);

      if (pages.length > 0) {
        if (!_gmus.contains(pages, page)) {
          // Show the first page that user enable it.
          page = pages[0];
        }
      }
      // Developer disable all pages, just return and don't show anything.
      else {
        return;
      }
    }

    // Clear notification queue
    self._notificationQueue = [];
    if (self._notificationTimer) {
      clearTimeout(self._notificationTimer);
    }

    var popupElement = self._elementFromTemplate('gimmie-view', {});
    var element = document.getElementById(self._root.substring(1));
    element.appendChild(popupElement);

    var rootView = popupElement.querySelector('.gimmie-fullscreen-popup');
    var closePageButton = popupElement.querySelector('.gimmie-view .gimmie-close');
    var mobileClosePageButton = popupElement.querySelector('.gimmie-mobile-close');
    var background = popupElement.querySelector('.gimmie-fullscreen-popup .gimmie-background');

    _o(closePageButton).bind('click', self._closePopup);
    _o(mobileClosePageButton).bind('click', self._closePopup);
    if (!self._configuration.debug) {
      _o(background).bind('click', self._closePopup);
    }

    var menus = popupElement.querySelectorAll('*[gimmie-page]');
    self._log('Menus: ', menus);
    for (var i = 0; i < menus.length; i++) {
      var menu = menus[i];
      if (!self._isPageEnabled(menu.getAttribute('gimmie-page'))) {
        menu.style.display = 'none';
      }
      _o(menu).bind('click', function (e) {
        var name = e.currentTarget.getAttribute('gimmie-page');
        self._selectPage(name, options);
      });
    }
    self._selectPage(page, options);
  }

  this._selectPage = function (page, options) {
    var pageFunction = self._pages[page];
    if (pageFunction) {
      self.track('Open navigation', { name: page });
      self._currentPage = page;
      var selectedMenu = document.querySelectorAll('*[gimmie-page].gimmie-selected');
      self._log ('Selected Menu\n', selectedMenu);
      for (var i = 0; i < selectedMenu.length; i++) {
        var menu = selectedMenu[i];
        menu.className = menu.className.replace(/gimmie-selected/,'').replace(/^\s+|\s+$/,'');
      }
      var currentMenu = document.querySelectorAll('*[gimmie-page=' + page + ']');
      self._log ('Current Menu\n', currentMenu);
      for (var i = 0; i < currentMenu.length; i++) {
        currentMenu[i].className += ' gimmie-selected';
      }
      self._log(currentMenu);

      // Hide other page on desktop
      var pages = document.querySelectorAll('.gimmie-desktop .gimmie-pages>div');
      for (var i = 0; i < pages.length; i++) {
        var page = pages[i];
        page.style.display = 'none';
      }
      // Remove current page from mobile
      var pagesContent = document.querySelector('.gimmie-mobile .gimmie-sub-content');
      while (pagesContent.firstChild) {
        pagesContent.removeChild(pagesContent.firstChild);
      }

      pageFunction.call(self, options);
    }
  }

  this._pages = {
    'catalog': function (options) {
      //Desktop View
      var loadingView = document.querySelector('.gimmie-view .gimmie-loading');
      loadingView.style.display = 'block';

      //Mobile View
      var mobileContentView = document.querySelector('.gimmie-mobile .gimmie-sub-content');
      var mobileLoadingElement = self._elementFromTemplate('mobile-reward-loading', {});
      mobileContentView.appendChild(mobileLoadingElement);

      self.API.loadCategories(function (data) {
        if (self._currentPage !== Widget.Pages.CATALOG) {
          return;
        }
        loadingView.style.display = 'none';
        mobileContentView.removeChild(mobileLoadingElement);

        if (data.response.success) {
          // Desktop
          var catalogView = document.querySelector('.gimmie-view .gimmie-catalog');
          catalogView.style.display = 'block';

          // Render catalog menu
          var menuElement = document.querySelector('.gimmie-catalog .gimmie-category');
          menuElement.innerHTML = '';

          var selectCategory = function (categoryName, options) {
            self.track('View category', { name: categoryName });
            var item = self._categories[categoryName];
            self._rewards = {};

            var category = item.category;
            var targetElement = item.element;
            var selectedElement = document.querySelector('.gimmie-catalog .gimmie-selected');
            if (selectedElement) {
              selectedElement.className = '';
            }

            targetElement.className = 'gimmie-selected';

            var itemsRootElement = document.querySelectorAll('.gimmie-catalog .gimmie-items');
            for (var i = 0; i < itemsRootElement.length; i++) {
              itemsRootElement[i].innerHTML = '';
            }

            var rewards = category.allRewards();
            var featuredRewards = _gmus.filter(rewards, function (reward) {
              return reward.featured && reward.isAvailable();
            });
            var normalRewards = _gmus.filter(rewards, function (reward) {
              return !reward.featured && reward.isAvailable();
            });
            var soldoutRewards = _gmus.filter(rewards, function (reward) {
              return reward.isSoldout();
            });

            if (self._configuration.options.shuffle_reward) {
              featuredRewards = _gmus.shuffle(featuredRewards);
              normalRewards = _gmus.shuffle(normalRewards);
            }

            rewards = featuredRewards.concat(normalRewards, soldoutRewards);

            _gmus.each(rewards, function (reward) {
              self._log (reward, '\n is soldout: ' + reward.isSoldout());
              self._rewards[reward.id] = reward;
              reward._soldout = reward.isSoldout();
              for (var i = 0; i < itemsRootElement.length; i++) {
                var element = self._elementFromTemplate('reward-item', reward);
                itemsRootElement[i].appendChild(element);

                self._log(element.getAttribute('gimmie-reward'));
                _o(element).bind('click', function (e) {
                  var rewardId = e.currentTarget.getAttribute('gimmie-reward');
                  var reward = self._rewards[parseInt(rewardId)];

                  self.track('View reward',
                             { reward_and_store: reward.store_name + ' - ' + reward.name,
                               name: reward.name,
                               id: reward.id });
                  if (self._configuration.user) {
                    if (reward.isAvailable()) {
                      self._log('Show reward detail\n', reward);
                      self._showReward(reward);
                    }
                  }
                  else {
                    self._showLogin();
                  }
                });
              }

            });

            // Sponsor here box
            if (!self._configuration.options.pages.catalog.hide_sponsor_here) {
              for (var i = 0; i < itemsRootElement.length; i++) {
                var element = self._elementFromTemplate('sponsor-here');
                itemsRootElement[i].appendChild(element);
                _o(element).bind('click', function (e) {
                  self.track('View sponsor here');

                  var sponsorURL = self._configuration.options.sponsor_url || 'https://portal.gimmieworld.com/sessions/new#signup';
                  window.open(sponsorURL);
                });
              }
            }

            self._log ('Show initail reward\n', options);
            if (options && self._configuration.user) {
              self._showReward(categories[0].getReward(options.reward));
            }
          }

          self._categories = {};
          var categories = data.response.categories;
          categories = _gmus.filter(categories, function (category) { return category.allRewards().length > 0 });
          _gmus.each(categories, function (category) {
            var element = self._elementFromTemplate('catalog-menu', category);
            menuElement.appendChild(element);

            self._categories[category.name] = {
              category: category,
              element: element
            };

            // Click on category menu
            _o(element).bind('click', function (e) {
              selectCategory(e.currentTarget.getAttribute('gimmie-category'));
            });

          });

          self._log('Categories\n', self._categories);
          var categoryMenuElement = document.querySelector('.gimmie-category-menu');
          var itemsElement = document.querySelector('.gimmie-items');
          var emptyElement = document.querySelector('.gimmie-empty-catalog');
          if (categories.length > 0) {
            var mobileCatalogView = self._elementFromTemplate('mobile-catalog', categories);
            mobileContentView.appendChild(mobileCatalogView);
            var mobileCategoryOptions = document.querySelector('.gimmie-category-option');
            _o(mobileCategoryOptions).bind('change', function (e) {
              selectCategory(e.currentTarget.value);
            });

            categoryMenuElement.style.display = 'block';
            itemsElement.style.display = 'block';
            emptyElement.style.display = 'none';
            selectCategory(categories[0].name, options);
          }
          else {
            categoryMenuElement.style.display = 'none';
            itemsElement.style.display = 'none';
            emptyElement.style.display = 'block';
          }

          var element = document.querySelector('.gimmie-category-login');
          if (element) {
            _o(element).bind('click', function (e) {
              self._showLogin();
            });
          }

        }
        else {
          var errorView = document.querySelector('.gimmie-view .gimmie-error');
          errorView.style.display = 'none';
        }
      });
    },

    'profile': function (options) {
      // Desktop
      var rootView = document.querySelector('.gimmie-view .gimmie-profile');
      rootView.style.display = 'block';

      while (rootView.firstChild) {
        rootView.removeChild(rootView.firstChild);
      }

      var element = self._elementFromTemplate('profile-detail', self._user);
      rootView.appendChild(element);

      //Mobile View
      var mobileContentView = document.querySelector('.gimmie-mobile .gimmie-sub-content');
      var mobileProfileElement = self._elementFromTemplate('mobile-profile', {
        mayorships_or_badges: self._configuration.options.pages.profile.badges || self._configuration.options.pages.profile.mayorships
      });
      mobileContentView.appendChild(mobileProfileElement);

      var badgesRowElement = mobileProfileElement.querySelector('.gimmie-badges');
      if (badgesRowElement) {
        _o(badgesRowElement).bind('click', function () {
          self.track('View mobile recent activities');

          var mobileSubPage = document.querySelector('.gimmie-mobile .gimmie-sub-page');
          var closeSubPage = function () {
            mobileSubPage.style.display = 'none';
          }
          // Badges
          var mobileBadgesElement = self._elementFromTemplate('mobile-badges');

          while (mobileSubPage.firstChild) {
            mobileSubPage.removeChild(mobileSubPage.firstChild);
          }
          mobileSubPage.appendChild(mobileBadgesElement);
          mobileSubPage.style.display = 'block';
          var mobileBackElement = mobileBadgesElement.querySelector('.gimmie-navigation .gimmie-back');
          var mobileCloseElement = mobileBadgesElement.querySelector('.gimmie-navigation .gimmie-mobile-close');

          _o(mobileBackElement).bind('click', closeSubPage);
          _o(mobileCloseElement).bind('click', self._closePopup);

          var mayorshipListElement = mobileBadgesElement.querySelector('.gimmie-mayorship .gimmie-list ul');
          for (var i = 0; i < self._user.profile.mayors.length; i++) {
            var mayorship = self._user.profile.mayors[i];
            mayorship.index = i;
            mayorship.type = 'mayor';
            var badgeElement = self._elementFromTemplate('mobile-badge', mayorship);
            mayorshipListElement.appendChild(badgeElement);
          }
          if (self._user.profile.mayors.length == 0) {
            var blankMayorshipElement = self._elementFromTemplate('mobile-empty-mayorships');
            var parentListElement = mobileBadgesElement.querySelector('.gimmie-mayorship .gimmie-list');
            parentListElement.appendChild(blankMayorshipElement);
          }

          var badgeListElement = mobileBadgesElement.querySelector('.gimmie-badge .gimmie-list ul');
          if (self._configuration.options.pages.profile.show_badge_recipe) {
            var loadingElement = self._elementFromTemplate('mobile-reward-loading');
            var parentListElement = mobileBadgesElement.querySelector('.gimmie-badge .gimmie-list');
            parentListElement.appendChild(loadingElement);

            var showProgress = false;
            if (self._configuration.options.pages.profile.show_badge_progress) {
              showProgress = true;
            }
            self.API.loadBadgesRecipe(showProgress, function (data) {
              parentListElement.removeChild(loadingElement);
              if (data.response.success) {
                var badges = data.response.badges.allBadges(self._user.profile);
                for (var i = 0; i < badges.length; i++) {
                  var badge = badges[i];
                  var tier = badge.unlockedTier(self._user.profile);
                  if (tier) {
                    tier.index = i;
                    var badgeElement = self._elementFromTemplate('mobile-badge', tier);
                    badgeListElement.appendChild(badgeElement);
                    _o(badgeElement).bind('click', function (e) {
                      var index = e.currentTarget.getAttribute('gimmie-index');
                      var badge = badges[index];
                      var detailPageElement = self._elementFromTemplate('mobile-badge-detail', badge.unlockedTier(self._user.profile));
                      mobileSubPage.appendChild(detailPageElement);

                      var detailBackElement = detailPageElement.querySelector('.gimmie-navigation .gimmie-back');
                      var detailCloseElement = detailPageElement.querySelector('.gimmie-navigation .gimmie-mobile-close');

                      _o(detailBackElement).bind('click', function () {
                        mobileSubPage.removeChild(detailPageElement);
                      });
                      _o(detailCloseElement).bind('click', self._closePopup);

                    });
                  }
                  else {
                    badge.firstTier.index = i;
                    var lockedElement = self._elementFromTemplate('mobile-locked-badge', badge.firstTier);
                    badgeListElement.appendChild(lockedElement);
                    _o(lockedElement).bind('click', function (e) {
                      var index = e.currentTarget.getAttribute('gimmie-index');
                      var badge = badges[index];
                      var detailPageElement = self._elementFromTemplate('mobile-locked-badge-detail', badge);
                      mobileSubPage.appendChild(detailPageElement);

                      var detailBackElement = detailPageElement.querySelector('.gimmie-navigation .gimmie-back');
                      var detailCloseElement = detailPageElement.querySelector('.gimmie-navigation .gimmie-mobile-close');

                      _o(detailBackElement).bind('click', function () {
                        mobileSubPage.removeChild(detailPageElement);
                      });
                      _o(detailCloseElement).bind('click', self._closePopup);

                      var progressElement = detailPageElement.querySelector('.gimmie-progress');
                      if (progressElement) {
                        var detailElement = progressElement.querySelector('.gimmie-detail');
                        var progress = Math.ceil(badge.firstTier.progress() * 100);
                        detailElement.innerHTML = 'Progress ' + progress + '%';
                        var barElement = progressElement.querySelector('.gimmie-bar');
                        barElement.style.width = progress + '%';
                      }
                    });

                  }
                }
              }
              else {
                var blankBadgesElement = self._elementFromTemplate('mobile-empty-badges');
                parentListElement.appendChild(blankBadgesElement);
              }
            });
          }
          else {
            for (var i = 0; i < self._user.profile.badges.length; i++) {
              var badge = self._user.profile.badges[i];
              badge.index = i;
              badge.type = 'badge';
              var badgeElement = self._elementFromTemplate('mobile-badge', badge);
              badgeListElement.appendChild(badgeElement);
              _o(badgeElement).bind('click', function (e) {
                var index = e.currentTarget.getAttribute('gimmie-index');
                var badge = self._user.profile.badges[index];
                var detailPageElement = self._elementFromTemplate('mobile-badge-detail', badge);
                mobileSubPage.appendChild(detailPageElement);

                var detailBackElement = detailPageElement.querySelector('.gimmie-navigation .gimmie-back');
                var detailCloseElement = detailPageElement.querySelector('.gimmie-navigation .gimmie-mobile-close');

                _o(detailBackElement).bind('click', function () {
                  mobileSubPage.removeChild(detailPageElement);
                });
                _o(detailCloseElement).bind('click', self._closePopup);

              });
            }
            if (self._user.profile.badges.length == 0) {
              var blankBadgesElement = self._elementFromTemplate('mobile-empty-badges');
              var parentListElement = mobileBadgesElement.querySelector('.gimmie-badge .gimmie-list');
              parentListElement.appendChild(blankBadgesElement);
            }
          }
        });
      }

      var redemptionRowElement = mobileProfileElement.querySelector('.gimmie-redemptions');
      _o(redemptionRowElement).bind('click', function () {
        self.track('View mobile redemptions');

        var mobileSubPage = document.querySelector('.gimmie-mobile .gimmie-sub-page');
        var closeSubPage = function () {
          mobileSubPage.style.display = 'none';
        }
        // Redemptions
        var mobileRedemptionPageElement = self._elementFromTemplate('mobile-redemptions', self._user);

        while (mobileSubPage.firstChild) {
          mobileSubPage.removeChild(mobileSubPage.firstChild);
        }
        mobileSubPage.appendChild(mobileRedemptionPageElement);
        mobileSubPage.style.display = 'block';
        var mobileBackElement = mobileRedemptionPageElement.querySelector('.gimmie-navigation .gimmie-back');
        var mobileCloseElement = mobileRedemptionPageElement.querySelector('.gimmie-navigation .gimmie-mobile-close');

        _o(mobileBackElement).bind('click', closeSubPage);
        _o(mobileCloseElement).bind('click', self._closePopup);

        var listElement = mobileRedemptionPageElement.querySelector('.gimmie-mobile-redemptions ul');
        for (var i = 0;i < self._user.profile.claims.length; i++) {
          var redemption = self._user.profile.claims[i];
          var redemptionElement = self._elementFromTemplate('mobile-redemption-row', redemption);
          listElement.appendChild(redemptionElement);
          if (redemption.reward.isExpired()) {
            var overlay = redemptionElement.querySelector('.gimmie-redemption-overlay');
            overlay.style.display = 'block';

            var expiresElement = redemptionElement.querySelector('.gimmie-expires-date');
            expiresElement.style.visibility = 'hidden';
          }
          else {
            _o(redemptionElement).bind('click', function(e) {
              var href = e.currentTarget.getAttribute('gimmie-href');
              window.open(href, '_blank');
            });
          }
        }
      });

      var activityRowElement = mobileProfileElement.querySelector('.gimmie-recent-activities');
      _o(activityRowElement).bind('click', function () {
        self.track('View mobile recent activities');

        var mobileSubPage = document.querySelector('.gimmie-mobile .gimmie-sub-page');
        var closeSubPage = function () {
          mobileSubPage.style.display = 'none';
        }
        // Activities
        var mobileRecentActivitiesElement = self._elementFromTemplate('mobile-activities');

        while (mobileSubPage.firstChild) {
          mobileSubPage.removeChild(mobileSubPage.firstChild);
        }
        mobileSubPage.appendChild(mobileRecentActivitiesElement);
        mobileSubPage.style.display = 'block';
        var mobileBackElement = mobileRecentActivitiesElement.querySelector('.gimmie-navigation .gimmie-back');
        var mobileCloseElement = mobileRecentActivitiesElement.querySelector('.gimmie-navigation .gimmie-mobile-close');

        _o(mobileBackElement).bind('click', closeSubPage);
        _o(mobileCloseElement).bind('click', self._closePopup);

        self.API.loadActivities(function (data) {
          if (data.response.success) {

            var listElement = mobileRecentActivitiesElement.querySelector('.gimmie-mobile-activities ul');
            var activities = data.response.recent_activities;


            activities = _gmus.filter(activities, function (activity) {
              if ((activity.type === 'mayor' ||
                   activity.type === 'badge') &&
                   activity.game.auth_key !== self._configuration.key) {
                return false;
              }
              return true;
            });

            var activityLoadingElement = mobileRecentActivitiesElement.querySelector('.gimmie-overlay');
            if (activities.length > 0) {
              activityLoadingElement.style.display = 'none';
            }
            else {
              activityLoadingElement.querySelector('.gimmie-sub-loading').style.display = 'none';
              activityLoadingElement.querySelector('.gimmie-sub-empty').style.display = 'block';
            }

            for (var i = 0; i < activities.length; i++) {
              var activity = activities[i];
              var activityElement = self._elementFromTemplate('mobile-activity-row', activity);
              listElement.appendChild(activityElement);
            }

          }
        });
      });

      // Desktop scroller
      var scrollerElement = element.querySelector('.gimmie-profile-scroller');

      self._log(self._user);
      var redemptionListElement = element.querySelector('.gimmie-redemption-list');
      if (redemptionListElement) {
        var maxInitialShow = self._user.profile.claims.length > 3 ? 3 : self._user.profile.claims.length;
        for (var i = 0; i < maxInitialShow; i++) {
          var redemption = self._user.profile.claims[i];
          var redemptionElement = self._elementFromTemplate('redemption-row', redemption);
          redemptionListElement.appendChild(redemptionElement);
          if (redemption.reward.isExpired()) {
            var overlay = redemptionElement.querySelector('.gimmie-redemption-overlay');
            overlay.style.display = 'block';

            var expiresDateElement = redemptionElement.querySelector('.gimmie-expires-date');
            expiresDateElement.style.display = 'none';
          }
          else {
            _o(redemptionElement).bind('click', function (e) {
              var href = e.currentTarget.getAttribute('gimmie-href');
              window.open(href, '_blank');
            });
          }
        }

        if (self._user.profile.claims.length > 3) {
          var allRedemptionsElement = element.querySelector('.gimmie-all-redemptions');
          allRedemptionsElement.style.display = 'block';
          _o(allRedemptionsElement).bind('click', function () {
            for (var i = maxInitialShow; i < self._user.profile.claims.length; i++) {
              var redemption = self._user.profile.claims[i];
              var redemptionElement = self._elementFromTemplate('redemption-row', redemption);
              redemptionListElement.appendChild(redemptionElement);
              if (redemption.reward.isExpired()) {
                var overlay = redemptionElement.querySelector('.gimmie-redemption-overlay');
                overlay.style.display = 'block';

                var expiresDateElement = redemptionElement.querySelector('.gimmie-expires-date');
                expiresDateElement.style.display = 'none';
              }
              else {
                _o(redemptionElement).bind('click', function (e) {
                  var href = e.currentTarget.getAttribute('gimmie-href');
                  window.open(href, '_blank');
                });
              }
            }
            allRedemptionsElement.style.display = 'none';
          });
        }
      }

      var bindBadgeDetailPopup = function (list, baseElement, badgeElement, popupClass) {
        var showPopup = function (e) {
          var index = e.currentTarget.getAttribute('gimmie-index');
          var type = e.currentTarget.getAttribute('gimmie-type');
          var current = type + '-' + index;

          var popupElement = baseElement.querySelector(popupClass);
          if (popupElement.style.display === 'block') {
            popupElement.style.display = 'none';
            if (popupElement.getAttribute('gimmie-current') === current) {
              return;
            }
          }

          var badge = list[index];
          var badgeDetailElement = self._elementFromTemplate('badge-detail', badge);
          var messageElement = badgeDetailElement.querySelector('.gimmie-message');
          if (badge.description) {
            messageElement.className = 'gimmie-message';
          }
          else {
            messageElement.className = 'gimmie-message gimmie-middle';
          }
          self.track('View badge', { name: badge.name });

          while (popupElement.firstChild) {
            popupElement.removeChild(popupElement.firstChild);
          }
          popupElement.appendChild(badgeDetailElement);
          popupElement.style.display = 'block';
          popupElement.setAttribute('gimmie-current', current);
          _o(popupElement).bind('click', function (e) {
            popupElement.style.display = 'none';
          });
        }

        _o(badgeElement).bind('click', showPopup);
      }

      var mayorshipListElement = element.querySelector('.gimmie-mayorship-list');
      if (mayorshipListElement) {
        var maxInitialMayorshipShow = self._user.profile.mayors.length > 5 ? 5 : self._user.profile.mayors.length;
        for (var i = 0; i < maxInitialMayorshipShow; i++) {
          var mayorship = self._user.profile.mayors[i];
          mayorship.index = i;
          mayorship.type = 'mayor';
          var badgeElement = self._elementFromTemplate('profile-badge', mayorship);
          mayorshipListElement.appendChild(badgeElement);
        }

        if (self._user.profile.mayors.length > 5) {
          var allMayorshipsElement = element.querySelector('.gimmie-all-mayorships');
          allMayorshipsElement.style.display = 'block';
          _o(allMayorshipsElement).bind('click', function () {
            for (var i = maxInitialMayorshipShow; i < self._user.profile.mayors.length; i++) {
              var mayorship = self._user.profile.mayors[i];
              var mayorshipElement = self._elementFromTemplate('profile-badge', mayorship);
              mayorshipListElement.appendChild(mayorshipElement);
            }
            allMayorshipsElement.style.display = 'none';
          });
        }
      }

      var badgeListElement = element.querySelector('.gimmie-badge-list');
      if (badgeListElement) {
        if (self._configuration.options.pages.profile.show_badge_recipe) {
          badgeListElement.style.display = 'none';

          var loading = element.querySelector('.gimmie-sub-loading');
          loading.style.display = 'block';

          var showProgress = false;
          if (self._configuration.options.pages.profile.show_badge_progress) {
            showProgress = true;
          }
          self.API.loadBadgesRecipe(showProgress, function (data) {
            if (data.response.success) {
              self._log ('Badges\n', data.response.badges);
              badgeListElement.style.display = 'block';
              loading.style.display = 'none';

              var renderBadge = function (badge) {
                var tier = badge.unlockedTier(self._user.profile);
                var element = null;
                if (tier) {
                  tier.index = i;
                  tier.type = 'badge';
                  var badgeElement = self._elementFromTemplate('profile-badge', tier);
                  badgeListElement.appendChild(badgeElement);
                  element = badgeElement;
                }
                else {
                  var badgeElement = self._elementFromTemplate('locked-badge', { index: i, type: 'badge', name: badge.firstTier.name });
                  badgeListElement.appendChild(badgeElement);
                  element = badgeElement;
                }

                _o(element).bind('click', function (e) {
                  var index = e.currentTarget.getAttribute('gimmie-index');
                  var type = e.currentTarget.getAttribute('gimmie-type');
                  var current = type + '-' + index;

                  var popupElement = rootView.querySelector('.gimmie-badge-popup');
                  if (popupElement.style.display === 'block') {
                    popupElement.style.display = 'none';
                    if (popupElement.getAttribute('gimmie-current') === current) {
                      return;
                    }
                  }

                  var badge = _allBadges[index];
                  var unlockedTier = badge.unlockedTier(self._user.profile);
                  var badgeDetailElement = null;
                  if (unlockedTier) {
                    badgeDetailElement = self._elementFromTemplate('badge-detail', unlockedTier);
                    var messageElement = badgeDetailElement.querySelector('.gimmie-message');
                    if (unlockedTier.description) {
                      messageElement.className = 'gimmie-message';
                    }
                    else {
                      messageElement.className = 'gimmie-message gimmie-middle';
                    }
                    self.track('View badge', { name: unlockedTier.name });

                  }
                  else {
                    badgeDetailElement = self._elementFromTemplate('locked-badge-detail', badge);
                    var progressElement = badgeDetailElement.querySelector('.gimmie-progress');

                    if (progressElement) {
                      var detailElement = progressElement.querySelector('.gimmie-detail');
                      var progress = Math.ceil(badge.firstTier.progress() * 100);
                      detailElement.innerHTML = 'Progress ' + progress + '%';
                      var barElement = progressElement.querySelector('.gimmie-bar');
                      barElement.style.width = progress + '%';
                    }
                    self.track('View Locked badge');
                  }

                  while (popupElement.firstChild) {
                    popupElement.removeChild(popupElement.firstChild);
                  }

                  popupElement.appendChild(badgeDetailElement);
                  popupElement.style.display = 'block';
                  popupElement.setAttribute('gimmie-current', current);
                  _o(popupElement).bind('click', function (e) {
                    popupElement.style.display = 'none';
                  });
                });
              }
              // - render badge

              var _allBadges = data.response.badges.allBadges(self._user.profile);
              var maxInitialBadgeShow = _allBadges.length > 5 ? 5 : _allBadges.length;
              for (var i = 0; i < maxInitialBadgeShow; i++) {
                var badge = _allBadges[i];
                renderBadge(badge);
              }

              // More than 5 badges
              if (_allBadges.length > 5) {
                var allBadgesElement = element.querySelector('.gimmie-all-badges');

                var message = allBadgesElement.querySelector('.gimmie-message');
                message.innerHTML = 'See All Badges (' + _allBadges.length + ')';

                allBadgesElement.style.display = 'block';
                _o(allBadgesElement).bind('click', function () {
                  for (var i = maxInitialBadgeShow; i < _allBadges.length; i++) {
                    var badge = self._user.profile.badges[i];
                    renderBadge(badge);
                  }
                });
              }
            }
          });
        }
        else {
          var maxInitialBadgeShow = self._user.profile.badges.length > 5 ? 5 : self._user.profile.badges.length;
          for (var i = 0; i < maxInitialBadgeShow; i++) {
            var badge = self._user.profile.badges[i];
            badge.index = i;
            badge.type = 'badge';
            var badgeElement = self._elementFromTemplate('profile-badge', badge);
            badgeListElement.appendChild(badgeElement);
            bindBadgeDetailPopup(self._user.profile.badges, element, badgeElement, '.gimmie-badge-popup');
          }

          if (self._user.profile.badges.length > 5) {
            var allBadgesElement = element.querySelector('.gimmie-all-badges');

            var message = allBadgesElement.querySelector('.gimmie-message');
            message.innerHTML = 'See All Badges (' + self._user.profile.badges.length + ')';

            allBadgesElement.style.display = 'block';
            _o(allBadgesElement).bind('click', function () {
              for (var i = maxInitialBadgeShow; i < self._user.profile.badges.length; i++) {
                var badge = self._user.profile.badges[i];
                badge.index = i;
                badge.type = 'badge';
                var badgeElement = self._elementFromTemplate('profile-badge', badge);
                badgeListElement.appendChild(badgeElement);
                bindBadgeDetailPopup(self._user.profile.badges, element, badgeElement, '.gimmie-badge-popup');
              }
            });
          }

        }
        // - show badge recipe
      }

      // Mobile counter
      var badgesCounter = document.querySelector('.gimmie-mobile .gimmie-badges .gimmie-counter');

      if (badgesCounter) {
        var totalBadges = 0;
        if (self._configuration.options.pages.profile.badges) {
          totalBadges += self._user.profile.badges.length;
        }
        if (self._configuration.options.pages.profile.mayorships) {
          totalBadges += self._user.profile.mayors.length;
        }
        badgesCounter.innerHTML = totalBadges;
      }
      // - badge element

      self.API.loadActivities(function (data) {
        var activityLoadingElement = element.querySelector('.gimmie-activities .gimmie-sub-loading');
        var emptyActivityElement = element.querySelector('.gimmie-activities .gimmie-empty-activities');
        var activityListElement = element.querySelector('.gimmie-activity-list');

        activityLoadingElement.style.display = 'none';
        self._log(data);
        self._log(emptyActivityElement);
        if (!data.response.success) {
          emptyActivityElement.style.display = 'block';
          activityListElement.style.display = 'none';
          return;
        }

        var recentActivities = data.response.recent_activities;
        recentActivities = _gmus.filter(recentActivities, function (activity) {
          if ((activity.type === 'mayor' || activity.type === 'badge') &&
              activity.game.auth_key !== self._configuration.key) {
            return false;
          }
          return true;
        });

        if (recentActivities.length > 0) {
          emptyActivityElement.style.display = 'none';
          activityListElement.style.display = 'block';

          // Clear all activity first
          while (activityListElement.firstChild) {
            activityListElement.removeChild(activityListElement.firstChild);
          }

          var maxInitialRecentActivities = recentActivities.length > 5 ? 5 : recentActivities.length;
          for (var i = 0; i < maxInitialRecentActivities; i++) {
            var recentActivity = recentActivities[i];
            var activityElement = self._elementFromTemplate('recent-activity', recentActivity);
            activityListElement.appendChild(activityElement);
          }


          if (recentActivities.length > 5) {
            var moreActivities = element.querySelector('.gimmie-all-activities');

            var message = moreActivities.querySelector('.gimmie-message');
            message.innerHTML = 'See All Activities (' + recentActivities.length + ')';

            moreActivities.style.display = 'block';
            _o(moreActivities).bind('click', function (e) {
              for (var i = maxInitialRecentActivities; i < recentActivities.length; i++) {
                var recentActivity = recentActivities[i];
                var activityElement = self._elementFromTemplate('recent-activity', recentActivity);
                activityListElement.appendChild(activityElement);
              }
              moreActivities.style.display = 'none';
            });
          }
        }
        else {
          emptyActivityElement.style.display = 'block';
          activityListElement.style.display = 'none';
        }

        // Mobile counter
        var activitiesCounter = document.querySelector('.gimmie-mobile .gimmie-recent-activities .gimmie-counter');
        activitiesCounter.innerHTML = recentActivities.length;

      });
    },

    'leaderboard': function (options) {
      var rootView = document.querySelector('.gimmie-view .gimmie-leaderboard');
      rootView.style.display = 'block';

      while (rootView.firstChild) {
        rootView.removeChild(rootView.firstChild);
      }

      var element = self._elementFromTemplate('gimmie-leaderboard-detail');
      rootView.appendChild(element);

      //Mobile View
      var mobileContentView = document.querySelector('.gimmie-mobile .gimmie-sub-content');

      var selectLeaderboard = function (board) {
        if (!board) return;

        var selectedMenu = element.querySelector('.gimmie-leaderboard-menu .gimmie-selected');
        var menu = element.querySelector('.gimmie-leaderboard-menu li[gimmie-leaderboard=' + board + ']');

        if (selectedMenu) {
          selectedMenu.className = '';
        }
        menu.className = 'gimmie-selected';
        // - menu render function

        var loadingElement = element.querySelector('.gimmie-leaderboard-content .gimmie-sub-loader');
        var contentElement = element.querySelector('.gimmie-leaderboard-content .gimmie-leaderboard-table');

        contentElement.style.display = 'none';
        loadingElement.style.display = 'block';

        while (contentElement.firstChild) {
          contentElement.removeChild(contentElement.firstChild);
        }
        // Clear old content first.

        // Mobile loading
        var leaderboardContent = mobileContentView.querySelector('.gimmie-leaderboard-content');
        var mobileLoadingElement = self._elementFromTemplate('mobile-reward-loading', {});

        while (leaderboardContent.firstChild) {
          leaderboardContent.removeChild(leaderboardContent.firstChild);
        }
        leaderboardContent.appendChild(mobileLoadingElement);

        self.API.top20(board, function (data) {
          loadingElement.style.display = 'none';
          contentElement.style.display = 'block';

          self._log('Leaderboard\n', data);
          if (data.response.success) {

            var players = data.response.players;
            players.forEach(function (player) {
              player.showName = self._configuration.options.pages.leaderboard.hide_name === false && player.name;
            });

            for (var i = 0; i < players.length; i++) {
              var player = players[i];
              if (i < 3) {
                player.rankImage = self._resourceRoot + 'leaderboard-' + (i+1) + '.png';
              }

              var playerRowElement = self._elementFromTemplate('leaderboard-row', player);
              contentElement.appendChild(playerRowElement);
            }

            // Mobile
            leaderboardContent.removeChild(mobileLoadingElement);
            var leaderboardTable = self._elementFromTemplate('mobile-leaderboard-table', data.response);
            leaderboardContent.appendChild(leaderboardTable);

          }
        });
      }
      // - select leaderboard

      var mobileLeaderboardView = self._elementFromTemplate('mobile-leaderboard');
      mobileContentView.appendChild(mobileLeaderboardView);

      var categoryOptions = mobileLeaderboardView.querySelector('.gimmie-category-option');
      _o(categoryOptions).bind('change', function (e) {
        var value = e.currentTarget.value;
        selectLeaderboard(value);
      });

      // TODO: Clean this leaderboard thing later.
      var leaderboardPages = [Gimmie.LeaderBoard.ORDER_BY_POINTS, Gimmie.LeaderBoard.ORDER_BY_REWARD_PRICE, Gimmie.LeaderBoard.ORDER_BY_REDEMPTIONS_COUNT];
      var leaderboardOptions = [ 'most_points', 'most_rewards', 'most_reward_value' ];
      for (var i = 0; i < leaderboardOptions.length; i++) {
        var option = leaderboardOptions[i];
        if (self._configuration.options.pages[Widget.Pages.LEADERBOARD][option] === false) {
          leaderboardPages.shift();
        }
        else {
          break;
        }
      }

      var initBoard = leaderboardPages.length > 0 ? leaderboardPages[0] : null;
      self._log (initBoard);
      selectLeaderboard(initBoard);
      var menus = element.querySelectorAll('.gimmie-leaderboard-menu li');
      for (var i = 0; i < menus.length; i++) {
        var menu = menus[i];
        _o(menu).bind('click', function (e) {
          var currentMenu = e.currentTarget;
          var board = currentMenu.getAttribute('gimmie-leaderboard');
          selectLeaderboard(board);
        });
      }

    },

    'help': function (options) {
      var helpElement = document.querySelector('.gimmie-pages>.gimmie-help');
      helpElement.style.display = 'block';

      var helpContent = self._elementFromTemplate('help-content');

      while(helpElement.firstChild) {
        helpElement.removeChild(helpElement.firstChild);
      }
      helpElement.appendChild(helpContent);

      var mobileSubContentElement = document.querySelector('.gimmie-mobile .gimmie-sub-content');
      var mobileHelpContent = self._elementFromTemplate('help-content');
      mobileSubContentElement.appendChild(mobileHelpContent);

      self._log('Help Element\n', helpElement);
    }

  }

  this._showReward = function (reward) {
    var rewardElement = document.querySelector('.gimmie-pages>.gimmie-reward');
    var mobileSubPage = document.querySelector('.gimmie-mobile .gimmie-sub-page');
    var closeDetailPage = function () {
      rewardElement.style.display = 'none';
      mobileSubPage.style.display = 'none';
    }

    // Desktop
    rewardElement.style.display = 'block';

    var html = self._renderTemplate('reward-detail', reward);
    html = html.replace('{{data.category_name}}', reward.category_name).replace('{{data.points}}', reward.points);
    rewardElement.innerHTML = html;
    var backElement = rewardElement.querySelector('.gimmie-navigation-back');
    _o(backElement).bind('click', closeDetailPage);

    var redeemButtonElement = rewardElement.querySelector('.gimmie-redeem-button');
    var claimButtonElement = rewardElement.querySelector('.gimmie-use-coupon-button');
    _o(claimButtonElement).bind('click', function () {
      window.open(reward.url, '_blank');
    });

    var redeemFunction = function () {
      var headerMessageElement = rewardElement.querySelector('.gimmie-header .gimmie-message');
      var mobileMessageElement = document.querySelector('.gimmie-mobile .gimmie-mobile-reward-detail .gimmie-message');
      var mobileRedeemButtonElement = document.querySelector('.gimmie-mobile .gimmie-mobile-reward-detail .gimmie-redeem-button');
      var mobileClaimButtonElement = document.querySelector('.gimmie-mobile .gimmie-mobile-reward-detail .gimmie-use-coupon-button');

      headerMessageElement.className = headerMessageElement.className.replace(/gimmie-header-error|gimmie-header-notice/,'').replace(/^\s+|\s+$/,'');
      mobileMessageElement.className = headerMessageElement.className.replace(/gimmie-header-error|gimmie-header-notice/,'').replace(/^\s+|\s+$/,'');
      redeemButtonElement.innerHTML = 'Redeeming reward';
      redeemButtonElement.disabled = true;
      mobileRedeemButtonElement.innerHTML = 'Redeeming reward';
      _o(redeemButtonElement).unbind('click', redeemFunction);
      _o(mobileRedeemButtonElement).unbind('click', redeemFunction);
      self.track('Redeem reward',
                 { reward_and_store: reward.store_name + ' - ' + reward.name,
                   name: reward.name,
                   id: reward.id });

      var isPopupLoaded = false;

      self.API.redeem(reward.id, function(data) {
        redeemButtonElement.disabled = false;
        if (data.response.success) {
          self.updatePoints();
          reward = data.response.claim.reward;

          var congratMessage = 'Congratulations! You just successfully redeemed this reward!';

          headerMessageElement.className += ' gimmie-header-notice';
          headerMessageElement.innerHTML = congratMessage;
          mobileMessageElement.className += ' gimmie-header-notice';
          mobileMessageElement.innerHTML = congratMessage;

          redeemButtonElement.style.display = 'none';
          mobileRedeemButtonElement.style.display = 'none';

          claimButtonElement.style.display = 'block';
          mobileClaimButtonElement.style.display = 'inline-block';

          var user = self._configuration.user;
          var url = reward.getClaimURL(user.realname, user.email);
          window.open(url, '_blank');
        }
        else {
          headerMessageElement.className += ' gimmie-header-error';
          mobileMessageElement.className += ' gimmie-header-error';

          var message = data.error.message;
          if (data.error.code === '409.5.4') {
            message = 'Sorry, your points is not enough for this reward';
          }
          else if (data.error.code === '409.5.6') {
            message = 'Sorry, you have already redeemed this reward. Please go to your profile to claim it.';
          }
          headerMessageElement.innerHTML = message;
          mobileMessageElement.innerHTML = message;
        }
        redeemButtonElement.innerHTML = 'Redeem with ' + reward.points + ' pts';
        mobileRedeemButtonElement.innerHTML = 'Redeem with ' + reward.points + ' pts';
        _o(redeemButtonElement).bind('click', redeemFunction);
        _o(mobileRedeemButtonElement).bind('click', redeemFunction);
        self._log('Redeem\n', data);
      });
    }
    _o(redeemButtonElement).bind('click', redeemFunction);

    var selectSectionFunction = function (e) {
      var selectedSection = rewardElement.querySelector('.gimmie-section.gimmie-selected');
      if (selectedSection) {
        selectedSection.className = selectedSection.className.replace(/gimmie-selected/,'').replace(/%\s+|\s+$/,'');
      }

      var selectedDetail = rewardElement.querySelector('.gimmie-detail.gimmie-selected');
      if (selectedDetail) {
        selectedDetail.className = selectedDetail.className.replace(/gimmie-selected/,'').replace(/%\s+|\s+$/,'');
      }

      var detailBlock = rewardElement.querySelector('.gimmie-' + e.currentTarget.getAttribute('gimmie-section') + '-text');
      e.currentTarget.className += ' gimmie-selected';
      detailBlock.className += ' gimmie-selected';
    }

    var sectionElements = rewardElement.querySelectorAll('.gimmie-section');
    for (var i = 0; i < sectionElements.length; i++) {
      var element = sectionElements[i];
      _o(element).bind('click', selectSectionFunction);
    }

    // Mobile
    var html = self._renderTemplate('mobile-reward-detail', reward);
    html = html.replace('{{data.points}}', reward.points).replace('{{user.points}}', config.user.profile.currentPoints);
    var mobileDetailElement = self._createElement(html);

    while (mobileSubPage.firstChild) {
      mobileSubPage.removeChild(mobileSubPage.firstChild);
    }
    mobileSubPage.appendChild(mobileDetailElement);
    mobileSubPage.style.display = 'block';
    var mobileBackElement = mobileDetailElement.querySelector('.gimmie-navigation .gimmie-back');
    var mobileCloseElement = mobileDetailElement.querySelector('.gimmie-navigation .gimmie-mobile-close');
    var mobileRedeemButtonElement = mobileDetailElement.querySelector('.gimmie-redeem-button');

    _o(mobileBackElement).bind('click', closeDetailPage);
    _o(mobileCloseElement).bind('click', self._closePopup);
    _o(mobileRedeemButtonElement).bind('click', redeemFunction);

    self._log(reward);
  }

  this._showLogin = function () {
    var showHelpFunction = function (e) {
      self._selectPage(Widget.Pages.HELP);
    }

    var loginPageElements = document.querySelectorAll('.gimmie-login');
    for (var i = 0; i < loginPageElements.length; i++) {
      loginPageElements[i].style.display = 'block';

      var helpLink = loginPageElements[i].querySelector('.gimmie-help-link');
      _o(helpLink).bind('click', showHelpFunction);

      var loginButton = loginPageElements[i].querySelector('.gimmie-login-button');
      if (loginButton) {
        _o(loginButton).bind('click', function () {
          self.track('Click login button');
          self._closePopup();
          self._configuration.events.login();
        });
      }

    }
  }

  this._hideLogin = function () {
    var loginPage = document.querySelector('.gimmie-login');
    loginPage.style.display = 'none';
  }

  this._importTemplate = function () {
    var rootElement = document.getElementById(this._root.substring(1));
    if (rootElement) {
      var templateID = 'gimmie-template-loader';
      if (!document.getElementById(templateID)) {
        var templateLoader = document.createElement('iframe');
        var templateSrc = self._configuration.options.template || this._resourceRoot + 'template.html';
        templateLoader.src = templateSrc;
        templateLoader.style.display = 'none';
        templateLoader.id = templateID;
        rootElement.appendChild(templateLoader);
      }
    }
  }

  this._embedTracker = function () {
    var rootElement = document.getElementById(this._root.substring(1));
    if (rootElement) {
      var trackerID = 'gimmie-tracker';
      if (!document.getElementById(trackerID)) {
        var trackerFrame = document.createElement('iframe');
        trackerFrame.src = this._resourceRoot + 'tracker.html#key=' + self._configuration.key + '&status=' + (self._configuration.user ? true : false);
        trackerFrame.style.display = 'none';
        trackerFrame.id = trackerID;
        rootElement.appendChild(trackerFrame);
      }
    }
  }

  this._renderTemplate = function (name, data) {
    var input = {
      root: self._resourceRoot,
      data: data,
      config: self._configuration,
      events: {}
    };

    if (self._configuration.events) {
      for (var key in self._configuration.events) {
        input.events[key] = true;
      }
    }

    var templateSrc = self._templates[name];
    if (self._configuration.templates && self._configuration.templates[name]) {
      templateSrc = self._configuration.templates[name];
    }
    var template = Hogan.compile(templateSrc);
    var html = template.render(input).replace(/^\s+|\s+$/, '');
    return html;
  }

  this._elementFromTemplate = function (name, data) {
    var html = self._renderTemplate(name, data);
    return self._createElement(html);
  }

  this._createElement = function (html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return div.firstChild;
  }

  this._registerAllHandlers = function () {
    var events = self._configuration.events;
    if (events) {
      for (var key in events) {
        if (!self._handlers[key]) {
          self._handlers[key] = [];
        }
        self._handlers[key].push(events[key]);
      }
    }
  }

  this._dispatch = function (name, data) {
    if (self._handlers[name]) {
      for (var i = 0; i < self._handlers[name].length; i++) {
        self._handlers[name][i](data);
      }
    }
  }

  /**
   * Show notification UI base on trigger output
   *
   * @param {Object} API output
   */
  this.triggerOutput = function (output) {
    if (output && output.response) {

      if (output.response.success) {

        // Show notification from latest recent activities
        if (output.response.recent_activities) {
          var activities = output.response.recent_activities;
          if (activities.length > 0) {
            var lastActivity = activities[0];
            var sameTimeActivities = [];

            var notifications = {
              point: [],
              instantReward: [],
              badge: [],
              mayor: [],
              level: []
            }

            // From Tiger site when trigger on different browsers (desktop and mobile.) 
            if (((new Date().getTime()) - (lastActivity.created_at * 1000)) > 5 * 60 * 1000 && !self._configuration.debug) {
              self._log ('Last activity: ', lastActivity.created_at * 1000);
              self._log ('Current: ', new Date().getTime());
              return;
            }

            for (var i = 0; i < activities.length; i++) {
              var currentActivity = activities[i];
              // Check if the event occur less than 10 milliseconds, add it to the queue
              if (lastActivity.created_at - currentActivity.created_at <= 10) {
                if (!currentActivity.detail) { continue; }

                if (currentActivity.type === Widget.ActivityType.ACTION) {
                  if (currentActivity.detail.action_type && 
                      currentActivity.detail.action_type === Widget.ActionType.AWARD_POINTS) {
                    notifications.point.push(currentActivity);
                  }
                  else if (currentActivity.detail.action_type && currentActivity.detail.action_type === Widget.ActionType.INSTANT_REWARD) {
                    notifications.instantReward.push(currentActivity);
                  }
                }
                else if (currentActivity.type === Widget.ActivityType.POINTS_CHANGE) {
                  notifications.point.push(currentActivity);
                }
                else if (notifications[currentActivity.type]) {
                  notifications[currentActivity.type].push(currentActivity);
                }
                else {
                  self._log ('Ignore activity: ' + currentActivity.type + ', ' + currentActivity.content);
                }
              }
              else {
                break;
              }

            }

            sameTimeActivities = sameTimeActivities.concat(
                notifications.mayor,
                notifications.badge,
                notifications.level,
                notifications.instantReward,
                notifications.point);
            self._notificationQueue = self._notificationQueue.concat(sameTimeActivities);
            self._showNotificationsInQueue();
          }
        }

      }
      // - response.success

    }
  }
  // - triggerOutput

  this.showCustomNotification = function (text) {
    self._notificationFunctions['custom'](text);
  }
  // - showCustomNotification

  this.updatePoints = function () {

    function _realUpdatePoints() {
      self.API.getProfile(true);

      if (self._configuration.options.auto_show_notification &&
          !self._configuration.options.push_notification &&
          !self._currentPage) {
        self.API.loadActivities(function (data) {
          self.triggerOutput(data);
        });
      }
    }

    if (self._configuration.user && !self._user) {
      var checkingUser = setInterval(function () {
        // TODO: Change to event handler.
        if (self._user) {
          clearInterval(checkingUser);
          _realUpdatePoints();
        }
      }, 1000);
    } else {
      _realUpdatePoints();
    }


  }
  // - updatePoints

  this._showNotificationsInQueue = function () {

    var fullscreen = document.querySelectorAll('.gimmie-fullscreen-notification');
    var bubble = document.querySelectorAll('.gimmie-bubble-notification');
    var showing = (fullscreen.length + bubble.length) > 0;

    self._log (fullscreen);
    self._log (bubble);
    self._log (showing);

    if (self._notificationQueue.length > 0 && !showing) {
      var headActivity = self._notificationQueue[0];
      self._notificationQueue = self._notificationQueue.slice(1);

      if (window.localStorage) {
        if (localStorage.getItem('activity_id-' + headActivity.id)) {
          self._showNotificationsInQueue();
          return;
        }

        localStorage.setItem('activity_id-' + headActivity.id, true);
      }

      // Skip notification from other games.
      if (headActivity.game && headActivity.game.auth_key !== self._configuration.key) {
        self._showNotificationsInQueue();
        return;
      }

      var type = headActivity.type;
      if (type === Widget.ActivityType.ACTION) {
        var activityDetail = headActivity.detail;
        var activityType = activityDetail.action_type;

        if (activityType && activityType === Widget.ActionType.AWARD_POINTS) {
          self._log('Notification: point, ' + headActivity.content);
          self._notificationFunctions['point'](headActivity);
        }
        else if (activityType && activityType === Widget.ActionType.INSTANT_REWARD) {
          self._notificationFunctions['instantReward'](headActivity);
        }
        else {
          // Unsupported activity type, continue on the queue
          self._showNotificationsInQueue();
        }

      }
      else if (self._notificationFunctions[type]) {
        self._notificationFunctions[type](headActivity);
      }
      else {
        // Unsupported notification type, continue on the queue
        self._showNotificationsInQueue();
      }

    }
  }

  this._notificationFunctions = {
    custom: function (text, actionFunction) {
      self._log('Custom notification\n',text)

      var timeout;
      var notificationElement = self._elementFromTemplate('custom-notification', {
        text: text
      });

      var element = document.getElementById(self._root.substring(1));
      element.appendChild(notificationElement);

      var closePopup = function (e) {
        clearTimeout(timeout);

        var notificationElement = document.querySelector('.gimmie-custom-notification');
        if (notificationElement) {
          var parent = notificationElement.parentElement;
          parent.removeChild(notificationElement);
        }
        self._showNotificationsInQueue();
      }
      var closeElement = document.querySelector('.gimmie-custom-notification .gimmie-close');

      if (actionFunction) {
        var messageElement = notificationElement.querySelector('.gimmie-message');
        var textElement = messageElement.querySelector('.gimmie-text');
        _o(messageElement).bind('click', actionFunction);
        _o(textElement).bind('click', actionFunction);
      }

      _o(closeElement).bind('click', function () {
        self.track ('Dismiss custom notification');
        self._notificationQueue = [];
        closePopup();
      });

      if (self._configuration.options.notification_timeout) {
        timeout = setTimeout(function () {
          closePopup();
        }, self._configuration.options.notification_timeout * 1000);
      }
    },
    points_change: function (activity) {
      self._log('Points change notification');
      self._notificationFunctions.custom(activity.content, function (e) {
        if (e.target === e.currentTarget) {
          self.track ('Click on points notification');
          self._showPopup(Widget.Pages.CATALOG);

          var notificationElement = document.querySelector('.gimmie-points-notification');
          if (notificationElement) {
            var parent = notificationElement.parentElement;
            parent.removeChild(notificationElement);
          }
          self._notificationQueue = [];
        }
      });
    },
    point: function (activity, featuresCategory) {
      self._log('Point notification\n', activity);
      self.API.loadCategories(function (data) {
        var featuredReward = null;
        if (data.response.success && data.response.categories.length > 0) {
          var category = data.response.categories[0];
          var features = category.redeemableRewards(self._user);
          var index = Math.floor((Math.random() * 1000) + 1) % features.length;
          featuredReward = features[index];

          self._rewards = {};
          var rewards = category.allRewards()
          _gmus.each(rewards, function (reward) {
            self._rewards[reward.id] = reward;
          });
        }

        var timeout;
        var notificationElement = self._elementFromTemplate('point-notification', {
          message: activity.content,
          feature: featuredReward,
          detail: activity.detail
        });

        var element = document.getElementById(self._root.substring(1));
        element.appendChild(notificationElement);

        var messageElement = notificationElement.querySelector('.gimmie-message');
        var textElement = messageElement.querySelector('.gimmie-text');

        var openCatalogFunction = function (e) {
          if (e.target === e.currentTarget) {
            self.track ('Click on points notification');
            self._showPopup(Widget.Pages.CATALOG);

            var notificationElement = document.querySelector('.gimmie-points-notification');
            if (notificationElement) {
              var parent = notificationElement.parentElement;
              parent.removeChild(notificationElement);
            }
            self._notificationQueue = [];
          }
        }
        _o(messageElement).bind('click', openCatalogFunction);
        _o(textElement).bind('click', openCatalogFunction);

        var rewardElement = notificationElement.querySelector('.gimmie-reward');
        if (rewardElement) {
          _o(rewardElement).bind('click', function (e) {
            var rewardId = e.currentTarget.getAttribute('gimmie-reward');
            var reward = self._rewards[rewardId];
            self.track('View featured reward',
                       { reward_and_store: reward.store_name + ' - ' + reward.name,
                         name: reward.name,
                         id: reward.id });

            self._showPopup(Widget.Pages.CATALOG, { reward: rewardId });
          });
        }

        var closePopup = function (e) {
          clearTimeout(timeout);

          var notificationElement = document.querySelector('.gimmie-points-notification');
          if (notificationElement) {
            var parent = notificationElement.parentElement;
            parent.removeChild(notificationElement);
          }
          self._showNotificationsInQueue();
        }
        var closeElement = document.querySelector('.gimmie-points-notification .gimmie-close');
        _o(closeElement).bind('click', function () {
          self.track ('Dismiss points notification');
          self._notificationQueue = [];
          closePopup();
        });

        if (self._configuration.options.notification_timeout) {
          timeout = setTimeout(function () {
            closePopup();
          }, self._configuration.options.notification_timeout * 1000);
        }
      });
    },
    instantReward: function (activity) {
      self._log('Instant reward notification\n', activity);
      var element  = self._elementFromTemplate('instant-reward-notification', activity);
      var rootElement = document.getElementById(self._root.substring(1));
      rootElement.appendChild(element);

      var closeElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-close');
      var backgroundElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-background');
      var notificationElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-instant-reward-notification');

      var dismissFunction = function (e) {
        self.track('Dismiss instant reward', { reward: activity.detail.claim.reward.id });
        var fullscreenNotification = document.querySelector('.gimmie-fullscreen-notification');
        rootElement.removeChild(fullscreenNotification);
        self._showNotificationsInQueue();
      }

      var claimFunction = function (e) {
        if (e.target !== closeElement) {
          self.track('Claim instant reward', { reward: activity.detail.claim.reward.id });
          var user = self._configuration.user;
          var url = activity.detail.claim.reward.getClaimURL(user.realname, user.email);
          self._log('Claim url: ' + url);

          window.open(url, '_blank');
        }
      }

      _o(notificationElement).bind('click', claimFunction);
      _o(closeElement).bind('click', dismissFunction);
      if (!self._configuration.debug) {
        _o(backgroundElement).bind('click', dismissFunction);
      }

    },
    level: function (activity) {
      self._log('Level notification\n', activity);
      self.track('View levelup notification');

      activity.next_level = activity.detail.level + 1;
      var element = self._elementFromTemplate('levelup-notification', activity);
      var rootElement = document.getElementById(self._root.substring(1));
      rootElement.appendChild(element);

      var dismissFunction = function (e) {
        rootElement.removeChild(element);
        self._showNotificationsInQueue();
      }

      var backgroundElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-background');
      var closeElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-close');
      _o(closeElement).bind('click', dismissFunction);
      if (!self._configuration.debug) {
        _o(backgroundElement).bind('click', dismissFunction);
      }
    },
    badge: function (activity) {
      self._log('Badge notification\n', activity);
      self.track('View badge notification', { name: activity.detail.name });
      var element = self._elementFromTemplate('badge-notification', activity);
      var rootElement = document.getElementById(self._root.substring(1));
      rootElement.appendChild(element);

      var dismissFunction = function (e) {
        rootElement.removeChild(element);
        self._showNotificationsInQueue();
      }

      var backgroundElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-background');
      var closeElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-close');
      _o(closeElement).bind('click', dismissFunction);
      if (!self._configuration.debug) {
        _o(backgroundElement).bind('click', dismissFunction);
      }
    },
    mayor: function (activity) {
      self._log('Mayor notification\n', activity);
      self.track ('View mayorship notification', { name: activity.detail.name });
      var element = self._elementFromTemplate('mayorship-notification', activity);
      var rootElement = document.getElementById(self._root.substring(1));
      rootElement.appendChild(element);

      var dismissFunction = function (e) {
        rootElement.removeChild(element);
        self._showNotificationsInQueue();
      }

      var backgroundElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-background');
      var closeElement = document.querySelector('.gimmie-fullscreen-notification .gimmie-close');
      _o(closeElement).bind('click', dismissFunction);
      if (!self._configuration.debug) {
        _o(backgroundElement).bind('click', dismissFunction);
      }
    }
  }

  /**
   * Embeding Javascript and CSS file
   */
  this.embed = function () {
    var self = this;

    var fontID = 'gimmie-font';
    var cssID = 'gimmie-css';
    var metaID = 'gimmie-meta';

    var head = document.getElementsByTagName('head')[0];
    var body = document.getElementsByTagName('body')[0];

    // Embed Meta
    if (!document.getElementById(metaID)) {
      var meta = document.createElement('meta');
      meta['http-equiv'] = 'X-UA-Compatible';
      meta['content'] = 'IE=edge';

      head.appendChild(meta);
    }

    // Embed Font
    if (!document.getElementById(fontID)) {
      var font = document.createElement('link');
      font.id = fontID;
      font.rel = 'stylesheet';
      font.type = 'text/css';
      font.href = 'http://fonts.googleapis.com/css?family=Open+Sans:300italic,400italic,600italic,700italic,800italic,400,800,700,600,300';
    }

    // Embed CSS
    if (!document.getElementById(cssID)) {
      var css = document.createElement('link');
      css.id = cssID;
      css.rel = 'stylesheet';
      css.type = 'text/css';
      css.href = self._resourceRoot + 'gimmie-widget2.css';
      css.media = 'screen';
      css.onload = function (e) {
        self._loaded.css = true;
      }

      head.appendChild(css);
    }

  }

  /**
   * Track an event to analyzer
   *
   * @param (String) event, event name
   * @param (Object) options, addition information for event
   */
  this.track = function (event, options) {
    var input = {
      event: event,
      options: options
    }
    var element = document.getElementById('gimmie-tracker');
    if (element) {
      self._log ('Track: ' + event);
      element.contentWindow.postMessage(JSON.stringify(input), '*');
    }
    else {
      self._log ('Cannot track event: ' + event);
    }
  }

  this._log = function (message, object) {
    if (typeof console && self._configuration.debug) {
      if (console.log.apply) {
        console.log.apply(console, arguments);
      }
      else {
        console.log (message);
      }
    }
  }

  // Initialize part
  var self = this;
  this._loaded = {
    css: false,
    template: false,
    bar: false
  };
  this._loading = false;
  this._resourceRoot = 'https://api.gimmieworld.com/cdn/client-';
  this._root = root;
  if (typeof _gimmie) {
    this._configuration = _gimmie;

    var config = this._configuration;

    config.user = config.user || {};
    config.user.name = config.user.name || "Guest";

    config.options = config.options || {};
    config.options.pages = config.options.pages || {};
    config.options.pages.catalog = config.options.pages.catalog || {};
    config.options.pages.profile = config.options.pages.profile || {};
    config.options.pages.profile.redemptions = typeof(config.options.pages.profile.redemptions) === 'boolean' ? config.options.pages.profile.redemptions : true;
    config.options.pages.profile.mayorships = typeof (config.options.pages.profile.mayorships) === 'boolean' ? config.options.pages.profile.mayorships : true;
    config.options.pages.profile.badges = typeof (config.options.pages.profile.badges) === 'boolean' ? config.options.pages.profile.badges : true;
    config.options.pages.profile.activities = typeof (config.options.pages.profile.activities) === 'boolean' ? config.options.pages.profile.activities : true;

    config.options.pages.leaderboard = config.options.pages.leaderboard || {};
    config.options.pages.leaderboard.hide_name = typeof (config.options.pages.leaderboard.hide_name) === 'boolean' ? config.options.pages.leaderboard.hide_name: false;
    config.options.pages.leaderboard.most_points = typeof (config.options.pages.leaderboard.most_points) === 'boolean' ? config.options.pages.leaderboard.most_points : true;
    config.options.pages.leaderboard.most_rewards = typeof (config.options.pages.leaderboard.most_rewards) === 'boolean' ? config.options.pages.leaderboard.most_rewards : true;
    config.options.pages.leaderboard.most_reward_value = typeof (config.options.pages.leaderboard.most_reward_value) === 'boolean' ? config.options.pages.leaderboard.most_reward_value : true;
  }
  else {
    this._configuration = {};
  }
  console.log ("Configuration, ", this._configuration);

  this._templates = {};
  this._notificationQueue = [];
  this._notificationTimer = null;
  this._handlers = {};
  this._user;
  this._categories;
  this._rewards;
  this._currentPage;

  this.embed();
  this.API = new Gimmie(this._configuration);
  this.API.addListener(Gimmie.Events.PROFILE_UPDATE, function (event) {
    if (event.response.success) {
      self._user.profile = event.response;

      self._log ('Update all users points elements');
      var userPointsElements = document.querySelectorAll('.gimmie-user-points');
      self._log ('User points: ', self._user.profile.currentPoints);
      for (var i = 0; i < userPointsElements.length; i++) {
        userPointsElements[i].innerHTML = self._user.profile.currentPoints;
      }

      self._log ('Update all users levels elements');
      var userLevelElements = document.querySelectorAll('.gimmie-user-level');
      self._log ('User level: ', self._user.profile.user.current_level);
      for (var i = 0; i < userLevelElements.length; i++) {
        userLevelElements[i].innerHTML = self._user.profile.user.current_level;
      }
    }
  });

  this.notification = {
    onOpen: function () {
      self._log('Push notification socket opens');
    },
    onMessage: function (message) {
      var message = message.replace(/^\s+|\s+$/, '');
      self._log('Got message: ', message);

      if (!self._configuration.options.push_notification) return;
      if (message) {
        try {
          var notifications = {
            point: [],
            instantReward: [],
            badge: [],
            mayor: [],
            level: []
          };

          var output = JSON.parse(message);
          self._log('Message after parse: ', message);

          if (!output.response.success) return;

          if (output.action === Widget.NotificationAction.TRIGGER) {
            var actions = output.response.actions;
            for (var i = 0; i < actions.length; i++) {
              var action = actions[i];
              if (!action.success) continue;

              var activity = {
                id: action.player_action_id,
                type: Widget.ActivityType.ACTION,
                content: action.message,
                detail: action
              }
              if (action && action.action_type && action.action_type === Widget.ActionType.INSTANT_REWARD) {
                notifications.instantReward.push(activity);
              }
              else if (action && action.action_type && action.action_type === Widget.ActionType.AWARD_POINTS) {
                notifications.point.push(activity);
              }
            }

            var badges = output.response.badges;
            for (var i = 0; i < badges.length; i++) {
              var badge = badges[i];
              var activity = {
                id: badge.id,
                type: Widget.ActivityType.BADGE,
                content: badge.name,
                detail: badge
              }
              notifications.badge.push(activity);
            }

            var user = output.response.user;
            var triggerLevel = user.current_level;
            var currentNextLevel = self._user.profile.nextLevel;
            self._log (triggerLevel, currentNextLevel);
            if (triggerLevel == currentNextLevel) {
              var activity = {
                id: 'level-' + triggerLevel,
                type: Widget.ActivityType.LEVEL,
                content: 'Level up',
                detail: {
                  level: triggerLevel,
                  name: user.current_level_name,
                  image_url: user.current_level_image_url,
                  image_url_retina: user.current_level_image_url_retina,
                  image_url_widget: user.current_level_image_url_widget,
                  points_to_next_level: user.points_to_next_level,
                  next_level: user.current_level + 1,
                  next_level_name: user.next_level_name
                }
              }
              notifications.level.push(activity);
            }

          }
          else if (output.action === Widget.NotificationAction.CHECKIN) {
            var mayor = output.response.mayor;
            if (mayor) {
              var activity = {
                id: mayor.id,
                type: Widget.ActivityType.MAYOR,
                content: mayor.name,
                detail: mayor
              }
              notifications.mayor.push(activity);
            }
          }

          var queue = [];
          var queue = queue.concat(
            notifications.mayor,
            notifications.badge,
            notifications.level,
            notifications.instantReward,
            notifications.point);
          self._notificationQueue = self._notificationQueue.concat(queue);
          self._showNotificationsInQueue();
          self._log ('Show notifications');
          self._log ('Notification Queue');
          self._log (queue);

          self.API.getProfile(true);
        }
        catch (e) {
          // Not json output
          self._log(e.stack);
          self._log(message);
        }
      }
    },
    onClose: function (reason) {
      self._log('Push notification socket closes with reason: ', reason);
    }
  }

  // Template loader
  var loadTemplateFunction = function (event) {
    if (event.data) {
      try {
        var data = JSON.parse(event.data);
        if (data.action === 'template') {
          self._templates = data.templates;

          var rootElement = document.getElementById(self._root.substring(1));
          var templateLoaderElement = document.getElementById('gimmie-template-loader');
          rootElement.removeChild(templateLoaderElement);
          _o(window).unbind('message', loadTemplateFunction);
          loadTemplateFunction = null;

          self._loaded.template = true;
        }
      }
      catch (e) {
        // Ignore it, other framework also use this method to load template e.g. Facebook.
      }
    }
  }

  _o(window).bind('message', loadTemplateFunction);

}

Widget.GUEST_COOKIE = '_gm_guest';
Widget.GUEST_TIMEOUT = '_gm_guest_timeout';

Widget.ActivityType = {
  ACTION: 'action',
  LEVEL : 'level',
  BADGE: 'badge',
  MAYOR: 'mayor',
  POINTS_CHANGE: 'points_change'
}

Widget.ActionType = {
  INSTANT_REWARD: 'Instant Reward',
  AWARD_POINTS: 'Award Points'
}

Widget.Events = {
  WIDGET_LOAD: 'widgetLoad',
  LOGIN: 'login'
}

Widget.Pages = {
  CATALOG: 'catalog',
  PROFILE: 'profile',
  LEADERBOARD: 'leaderboard',
  HELP: 'help'
}

Widget.NotificationAction = {
  TRIGGER: 'trigger',
  CHECKIN: 'check_in'
}
