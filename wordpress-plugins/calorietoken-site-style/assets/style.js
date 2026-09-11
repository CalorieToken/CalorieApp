/* CalorieToken Site Style — GPL-2.0-or-later */
(function () {
  'use strict';
  var cfg = window.CalorieTokenSiteStyle;
  var protectedContent = 'form,input,select,textarea,iframe,video,audio,canvas,[contenteditable],.xl-card,[data-calorieapp-embed]';
  var bannerFile = /\/kopje-banner(?:[123])?(?:-\d+)?\.png(?:["')?]|$)/i;
  function plain(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function background(node) { return window.getComputedStyle(node).backgroundImage || ''; }
  function imageVar(name, url) {
    if (url && /^https?:\/\//.test(url)) document.body.style.setProperty(name, 'url(' + JSON.stringify(url) + ')');
  }
  function safeTitleBox(node, heading, splitTitle) {
    if (!node || node.querySelector(protectedContent + ',img,a,button')) return false;
    var headings = Array.from(node.querySelectorAll('h1,h2,h3'));
    if (!headings.includes(heading) || (!splitTitle && headings.length !== 1) || headings.length > 3) return false;
    var titleText = headings.map(function (item) { return plain(item.textContent); }).join('');
    if (!titleText || titleText.length > 180) return false;
    var copy = node.cloneNode(true);
    copy.querySelectorAll('script,style,svg,.brz-bg').forEach(function (item) { item.remove(); });
    return plain(copy.textContent).replace(/\s/g, '') === titleText.replace(/\s/g, '');
  }
  function styleTitle(frame, heading) {
    frame.classList.add('ctstyle-title');
    heading.classList.add('ctstyle-heading');
    if (frame !== heading) {
      for (var node = heading.parentElement; node && node !== frame; node = node.parentElement) {
        node.classList.add('ctstyle-title-inner');
      }
      frame.querySelectorAll('.brz-bg').forEach(function (node) { node.classList.add('ctstyle-title-old-bg'); });
      frame.querySelectorAll('p').forEach(function (node) {
        if (!plain(node.textContent) && !node.querySelector('img,svg,a,button')) node.classList.add('ctstyle-empty-title-line');
      });
    }
  }
  function styleHeader() {
    var styled = document.querySelector('.ctstyle-header');
    if (styled) return styled;
    var menu = document.querySelector('.brz-menu-simple');
    var header = menu && menu.closest('.brz-section,section,header');
    if (!header) header = document.querySelector('.showcase-page-header,header.site-header,#masthead');
    if (header) {
      header.classList.add('ctstyle-header');
      if (header.classList.contains('brz-section')) {
        var content = header.querySelector('.brz-section__content');
        if (content) content.classList.add('ctstyle-header-content');
        var bg = content && content.querySelector(':scope > .brz-bg > .brz-bg-image');
        if (bg) bg.classList.add('ctstyle-header-bg');
        // Only the existing shared brand/menu container; never an account column.
        var logo = header.querySelector('img[src*="C-Logotranspa"]');
        for (var parent = menu && menu.parentElement; parent && parent !== header; parent = parent.parentElement) {
          if (logo && parent.contains(logo) && !parent.querySelector(protectedContent)) {
            parent.classList.add('ctstyle-brand');
            break;
          }
        }
      }
      return header;
    }
    var first = document.querySelector('.brz-section,.entry-content,main');
    var template = document.getElementById('ctstyle-header-template');
    if (!first || !template) return null;
    var fallback = template.content.firstElementChild.cloneNode(true);
    first.parentNode.insertBefore(fallback, first);
    var source = document.getElementById('ctstyle-native-account-source');
    var slot = fallback.querySelector('.ctstyle-header-account');
    if (source && slot && source.querySelectorAll('.xl-card').length===1) {
      // Fresh output of the installed Xaman shortcode, moved once, never cloned.
      var others=Array.from(document.querySelectorAll('.xl-card')).filter(function (card) {return !source.contains(card);});
      if (!others.length) {slot.append(source);source.hidden=false;slot.hidden=false;}
    }
    return fallback;
  }
  function styleTitles(header) {
    // First, recognize actual title artwork, including Blog's older banner.
    var headings = Array.from(document.querySelectorAll('h1')).filter(function (h) {
      return !h.closest(protectedContent + ',.ctstyle-header,.showcase-page-header,header,footer');
    });
    headings.slice(0, 1).forEach(function (heading) {
      var frame = null, artworkFound = false;
      for (var node = heading.parentElement; node && node !== document.body; node = node.parentElement) {
        if (node.matches('.brz-section,main,.entry-content')) break;
        var ownBg = node.querySelector(':scope > .brz-bg > .brz-bg-image');
        if (bannerFile.test(background(node)) || (ownBg && bannerFile.test(background(ownBg)))) {
          artworkFound = true;
          if (safeTitleBox(node, heading, true)) frame = node;
        }
      }
      if (frame) {
        // A title may be split into several native heading nodes (Donation In / XRP).
        // Use one outer artwork frame; keep every text node and retire nested decoration.
        frame.querySelectorAll('h1,h2,h3').forEach(function (part) { styleTitle(frame, part); });
      }
      else if (!artworkFound && (heading.matches('.entry-title,.showcase-page-title') || heading.closest('[id^="calorie-title-"],.brz-rich-text'))) {
        var host = heading.parentElement;
        styleTitle(safeTitleBox(host, heading) ? host : heading, heading);
      }
    });
    if (headings.length || !cfg.title || document.querySelector('.ctstyle-title,.woocommerce,.product')) return;
    // Older usecases contain their original illustrations but no text H1.
    var first = Array.from(document.querySelectorAll('.brz-section')).find(function (node) {
      return node !== header && !(header && header.contains(node));
    }) || document.querySelector('.entry-content,main');
    if (!first) return;
    var section = document.createElement('section');
    section.className = 'ctstyle-title-section';
    var frame = document.createElement('div');
    var heading = document.createElement('h1');
    heading.textContent = cfg.title;
    frame.appendChild(heading);
    section.appendChild(frame);
    styleTitle(frame, heading);
    first.parentNode.insertBefore(section, first);
  }
  function canonicalURL(value) {
    try {
      var url = new URL(value, window.location.href);
      if (/^(www\.)?twitter\.com$/.test(url.hostname) && /^\/CalorieToken\/?$/i.test(url.pathname)) url.hostname = 'x.com';
      if (url.href === 'https://t.me/joinchat/8jIusxwzMVI0NGVk') return 'https://t.me/+7YxaKdQYWNA0NDA0';
      return url.origin + url.pathname.replace(/\/$/, '') + url.search + url.hash;
    } catch (_) { return ''; }
  }
  function knownFooter(node, allowed) {
    if (node.querySelector(protectedContent + ',img') || node.matches('.ctstyle-footer')) return false;
    if (Array.from(node.querySelectorAll('button')).some(function (b) { return !b.closest('.brz-carousel,[data-calorieapp-social-carousel]'); })) return false;
    if (Array.from(node.querySelectorAll('a[href]')).some(function (a) { return !allowed.has(canonicalURL(a.getAttribute('href'))); })) return false;
    var copy = node.cloneNode(true);
    copy.querySelectorAll('script,style,svg,.brz-bg,.brz-carousel,.calorieapp-shared-socials').forEach(function (n) { n.remove(); });
    var text = plain(copy.textContent);
    var current = /Operator: ICTHendrikse · KVK 73774693/;
    var legacy = /Chamber of Commerce KVK: 84216352/;
    var currentCopy = /© \d{4} ICTHendrikse \(owned content only\) · CalorieToken® trade mark: Pieter Hendrikse/;
    var legacyCopy = /© \d{4} Calorie ?Token/;
    if (!((current.test(text) && currentCopy.test(text)) || (legacy.test(text) && legacyCopy.test(text)))) return false;
    return !plain(text.replace(current, '').replace(legacy, '').replace(currentCopy, '').replace(legacyCopy, '')
      .replace('Calorie aims to be the world’s food token', '').replace('Privacy Policy', '').replace('Terms & Conditions', ''));
  }
  function styleFooter() {
    if (document.querySelector('.ctstyle-footer')) return;
    var template = document.getElementById('ctstyle-footer-template');
    if (!template) return;
    var fallback = template.content.firstElementChild.cloneNode(true);
    var allowed = new Set(Array.from(fallback.querySelectorAll('a')).map(function (a) { return canonicalURL(a.getAttribute('href')); }));
    var regions = Array.from(document.querySelectorAll('.brz-section,footer,[role="contentinfo"],.calorieapp-shared-footer'));
    var known = regions.filter(function (node) { return knownFooter(node, allowed); });
    known = known.filter(function (node) { return !known.some(function (parent) { return parent !== node && parent.contains(node); }); });
    var shared = document.querySelector('.calorieapp-shared-footer');
    var canonical = shared && knownFooter(shared, allowed) && shared.querySelectorAll('.calorieapp-shared-social').length === 7 ? shared : null;
    var unknown = regions.some(function (node) {
      if (known.some(function (parent) { return parent === node || parent.contains(node); })) return false;
      return (node.matches('footer,[role="contentinfo"]') || /(?:ICTHendrikse|Chamber of Commerce KVK:)[\s\S]*©/.test(node.textContent)) &&
        !node.hidden && window.getComputedStyle(node).display !== 'none';
    });
    // Retain unfamiliar/custom footers, rather than hiding possible page content.
    if (!canonical && !known.length && unknown) return;
    var footer = canonical || fallback;
    if (!canonical) {
      if (known.length) known[0].parentNode.insertBefore(footer, known[0]);
      else template.parentNode.insertBefore(footer, template);
    }
    footer.classList.add('ctstyle-footer');
    footer.hidden = false;
    known.forEach(function (node) {
      if (node !== footer && !node.contains(footer)) node.classList.add('ctstyle-retired-footer');
    });
    if (canonical) {
      // Adopt the installed bridge's existing row so shared translations and
      // cookie controls also apply. Copy only missing public template links.
      var legal = footer.querySelector('.calorieapp-shared-legal-links');
      if (legal) {
        legal.classList.add('ctstyle-legal-links');
        var present = new Set(Array.from(legal.querySelectorAll('a[href]')).map(function (a) {
          return canonicalURL(a.getAttribute('href'));
        }));
        fallback.querySelectorAll('.ctstyle-legal-links a[href]').forEach(function (a) {
          var url = canonicalURL(a.getAttribute('href'));
          if (url && !present.has(url)) { legal.append(a.cloneNode(true)); present.add(url); }
        });
      }
      return; // The installed bridge still owns its carousel and handlers.
    }
    var track = footer.querySelector('.ctstyle-social-track');
    footer.querySelectorAll('[data-ctstyle-direction]').forEach(function (button) {
      button.addEventListener('click', function () {
        var item = track.firstElementChild;
        var step = item.getBoundingClientRect().width || track.clientWidth;
        var rtl = window.getComputedStyle(track).direction === 'rtl' ? -1 : 1;
        track.scrollBy({left: Number(button.dataset.ctstyleDirection) * step * rtl,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      });
    });
  }
  function refineContact() {
    if (!document.body.matches('.page-id-1213,.page-id-7990')) return;
    var socialIds=['lmvnxkhqzmkevzudnrxtipkeumxijxybdggv','enqyzczmksaoquqilyjefxzhsvnmzsavymzq','bxlcizhamonqghxwwbshidpcmrhgxcifyozk','wzahqxpifnpwycwywcyqpydkkhhbwogiocfd','tvesjaisdpqzkbrfbhdrzacmghxowhqflxnb','azosjstwrsvddyvbcjqaauanefbczihlvbhf'];
    var socialCards=socialIds.map(function (id) {var nodes=document.querySelectorAll('[data-brz-custom-id="'+id+'"]');return nodes.length===1 ? nodes[0].closest('.brz-columns') : null;});
    if (socialCards.every(function (card) {return card && !card.closest(protectedContent) && !card.querySelector(protectedContent);})) {
      var rows=Array.from(new Set(socialCards.map(function (card) {return card.closest('.brz-row__container');})));
      if (rows.length===3 && rows.every(function (row) {return row && row.parentElement===rows[0].parentElement;})) {
        socialCards.forEach(function (card) {card.classList.add('ctstyle-contact-social-card');});
        rows.forEach(function (row,index) {
          row.classList.add('ctstyle-contact-social-row');if (!index) row.classList.add('ctstyle-contact-social-first');
          row.querySelectorAll(':scope > .brz-row > .brz-columns').forEach(function (col) {
            if (!socialCards.includes(col) && !plain(col.textContent) && !col.querySelector(protectedContent+',img,a,button,svg')) col.classList.add('ctstyle-contact-social-spacer');
          });
        });
      }
    }
    var telegram=document.querySelector('[data-brz-custom-id="wzahqxpifnpwycwywcyqpydkkhhbwogiocfd"] a');
    if (telegram && telegram.getAttribute('href')==='https:/https://t.me/+7YxaKdQYWNA0NDA0t.me/+7YxaKdQYWNA0NDA0') {
      var raw=telegram.getAttribute('data-href'), meta=null;
      try {if (raw) meta=JSON.parse(decodeURIComponent(raw));} catch (_) {meta=null;}
      if (!raw || (meta && meta.type==='external' && meta.external===telegram.getAttribute('href'))) {
        telegram.href='https://t.me/+7YxaKdQYWNA0NDA0';
        if (meta) {meta.external=telegram.href;telegram.setAttribute('data-href',encodeURIComponent(JSON.stringify(meta)));}
      }
    }
    var team = document.querySelector('[data-brz-custom-id="ildhtbtlsjrdtjykerlusgfqtahtavhmybrr"]');
    if (team && !team.closest(protectedContent) && !team.querySelector(protectedContent)) {
      var row = team.querySelector(':scope > .brz-row');
      if (row && row.querySelectorAll(':scope > .brz-columns').length === 3) team.classList.add('ctstyle-contact-team');
    }
    // The reviewed secondary Team banner; retain its own heading and dimensions.
    var teamBanner = document.querySelector('[data-brz-custom-id="rttsbzcjbrcpajxhvuzxgngxhgsxbgoqrpdn"] > .brz-bg > .brz-bg-image');
    if (teamBanner && bannerFile.test(background(teamBanner))) teamBanner.classList.add('ctstyle-contact-team-bg');

    var oldTelegram = 'https://t.me/joinchat/8jIusxwzMVI0NGVk';
    var currentTelegram = 'https://t.me/+7YxaKdQYWNA0NDA0';
    document.querySelectorAll('.brz-image a[href="' + oldTelegram + '"]').forEach(function (link) {
      if (link.closest(protectedContent) || link.querySelector(protectedContent)) return;
      var metadata = null;
      var encoded = link.getAttribute('data-href');
      if (encoded) {
        try { metadata = JSON.parse(decodeURIComponent(encoded)); } catch (_) { return; }
        if (!metadata || metadata.type !== 'external' ||
            [oldTelegram, currentTelegram].indexOf(metadata.external) === -1) return;
      }
      link.setAttribute('href', currentTelegram);
      if (metadata && metadata.external === oldTelegram) {
        metadata.external = currentTelegram;
        link.setAttribute('data-href', encodeURIComponent(JSON.stringify(metadata)));
      }
    });

    var paragraph = document.querySelector('p[data-uniq-id="s8hlx"]');
    if (!paragraph || paragraph.closest(protectedContent) || paragraph.querySelector(protectedContent) ||
        plain(paragraph.textContent) !== 'Mail: info@calorietoken.net') return;
    var links = paragraph.querySelectorAll('a');
    if (links.length !== 2) return;
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      var oldAddress = /^mailto:info(?:#|%23)calorietoken\.net$/i;
      var metadata = null;
      var encoded = link.getAttribute('data-href');
      if (encoded) {
        try { metadata = JSON.parse(decodeURIComponent(encoded)); } catch (_) { return; }
        if (!metadata || metadata.type !== 'external' || !oldAddress.test(metadata.external)) return;
      }
      // Changed CMS destinations win. Only the observed '#' typo is corrected.
      if (href ? !oldAddress.test(href) : !metadata) return;
      link.setAttribute('href', 'mailto:info@calorietoken.net');
      if (metadata) {
        metadata.external = 'mailto:info@calorietoken.net';
        link.setAttribute('data-href', encodeURIComponent(JSON.stringify(metadata)));
      }
    });
  }
  function marketOnly(node) {
    var copy = node.cloneNode(true);
    copy.querySelectorAll('.calorieapp-xpmarket-widget,[data-calorieapp-xpmarket-widget],script,style,.brz-bg').forEach(function (item) { item.remove(); });
    return !plain(copy.textContent) && !copy.querySelector('a,img,svg,iframe,video,audio,canvas,form,input,button,select,textarea,[contenteditable],.xl-card,[data-calorieapp-embed]');
  }
  function refineMarketLayout() {
    document.querySelectorAll('.calorieapp-xpmarket-widget,[data-calorieapp-xpmarket-widget]').forEach(function (widget) {
      var excluded = protectedContent + ',[hidden],[inert],[aria-hidden="true"],.cmplz-blocked-content-container';
      if (widget.closest(excluded) || widget.querySelector(protectedContent + ',button')) return;
      widget.classList.add('ctstyle-market-card');
      var host = widget.closest('.brz-wp-shortcode');
      if (!host || !marketOnly(host)) return;
      var row = host.closest('.brz-row');
      // A market card beside team/content columns keeps that shared layout.
      if (row && !marketOnly(row)) return;
      for (var node = host; node && node !== document.body; node = node.parentElement) {
        if (node.matches('.brz-container,.brz-section,section,main') || !marketOnly(node)) break;
        if (node.matches('.brz-wp-shortcode,.brz-wrapper,.brz-column__items,.brz-columns,.brz-row,.brz-row__container')) node.classList.add('ctstyle-market-layout');
      }
      if (widget.parentElement !== host && marketOnly(widget.parentElement)) widget.parentElement.classList.add('ctstyle-market-inner');
    });
  }
  function refineGalleryControls() {
    if (!document.body.matches('.page-id-1207')) return;
    var gallery = document.getElementById('metaslider-id-819');
    if (!gallery || gallery.closest(protectedContent)) return;
    var numbered = Array.from(gallery.querySelectorAll('.nivo-controlNav a'));
    gallery.querySelectorAll('.nivo-directionNav a,.nivo-controlNav a').forEach(function (control) {
      if (control.closest(protectedContent + ',[hidden],[inert],[aria-hidden="true"]') ||
          control.dataset.ctstyleGalleryReady === '1' || control.dataset.calorieappKeyboard === '1') return;
      var role = control.getAttribute('role');
      if (role && role !== 'button') return;
      control.setAttribute('role', 'button');
      if (!control.hasAttribute('tabindex')) control.setAttribute('tabindex', '0');
      if (!control.hasAttribute('aria-label')) {
        var label = control.classList.contains('nivo-prevNav') ? 'Previous artwork'
          : control.classList.contains('nivo-nextNav') ? 'Next artwork'
          : 'Show artwork ' + (plain(control.textContent) || (numbered.indexOf(control) + 1));
        control.setAttribute('aria-label', label);
      }
      control.classList.add('ctstyle-gallery-control');
      control.addEventListener('keydown', function (event) {
        if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
            (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        control.click();
      });
      control.dataset.ctstyleGalleryReady = '1';
      // Coordinate with the already prepared bridge enhancement if it loads later.
      control.dataset.calorieappKeyboard = '1';
    });
  }
  function boot() {
    // WordPress localizes top-level booleans as "1" / "".
    if (cfg && (cfg.footerOnly === true || cfg.footerOnly === '1') && document.body && document.body.classList.contains('ctstyle-footer-only') &&
        document.body.matches('.home,.page-id-1090') && !document.body.matches('.page-id-8001,.brz-ed') &&
        !document.querySelector('.brz-ed,#brz-ed-iframe') && !/\/wp-admin\//.test(window.location.pathname) &&
        !Array.from(new URL(window.location.href).searchParams.keys()).some(function (key) {
          return /^(preview|customize_changeset_uuid|brizy-edit|brizy-edit-iframe|brz-edit|brz-edit-iframe)$/.test(key);
        })) {
      imageVar('--ctstyle-paper-image', cfg.paperImage);
      imageVar('--ctstyle-header-image', cfg.headerImage);
      styleFooter();
      return;
    }
    if (!cfg || !document.body || !document.body.classList.contains('ctstyle-enabled') ||
        document.body.matches('.home,.page-id-1090,.page-id-8001,.brz-ed') ||
        document.querySelector('#brz-ed-iframe') || /\/wp-admin\//.test(window.location.pathname)) return;
    imageVar('--ctstyle-header-image', cfg.headerImage);
    imageVar('--ctstyle-title-image', cfg.titleImage);
    imageVar('--ctstyle-paper-image', cfg.paperImage);
    var header = styleHeader();
    styleTitles(header);
    styleFooter();
    refineContact();
    refineMarketLayout();
    refineGalleryControls();
    if (document.readyState !== 'complete') window.addEventListener('load', refineMarketLayout, {once: true});
    if (document.readyState !== 'complete') window.addEventListener('load', refineGalleryControls, {once: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
