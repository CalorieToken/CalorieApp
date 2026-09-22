/* Shared, reviewed help copy for the website and its embedded CalorieApp. */
(function(){'use strict';
  var cfg=window.CalorieTokenHelp,labels=window.CalorieTokenHeadingRepairLabels,topics=window.CalorieTokenHeadingRepairTopics;
  if(!cfg||!cfg.copy||!labels)return;
  var avatar=window.CalorieTokenHeadingRepairAvatar;
  if(typeof avatar==='string'&&avatar.trim())cfg.avatar=avatar;
  Object.keys(labels).forEach(function(tag){
    if(!Object.prototype.hasOwnProperty.call(cfg.copy,tag))return;
    var copy=cfg.copy[tag];if(!copy||typeof copy!=='object')return;
    if(!copy.linkLabels||typeof copy.linkLabels!=='object')copy.linkLabels={};
    Object.keys(labels[tag]).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(copy.linkLabels,key))copy.linkLabels[key]=labels[tag][key];});
    var directTopics={recipes:['foodRecipes','foodRecipesHelp'],search:['foodSearch','foodSearchHelp'],compare:['foodCompare','foodCompareHelp'],scan:['foodScan','foodScanHelp'],account:['account','accountHelp'],export:['accountExport','accountExportHelp'],move:['accountMove','accountMoveHelp'],diary:['foodDiary','foodDiaryHelp']};
    if(copy.topics)Object.keys(directTopics).forEach(function(key){var fields=directTopics[key];copy.topics[key]={title:labels[tag][fields[0]],text:labels[tag][fields[1]],links:[]};});
    var additions=topics&&topics[tag];
    if(!additions||!copy.topics||typeof copy.topics!=='object')return;
    Object.keys(additions).forEach(function(key){
      var current=copy.topics[key],addition=additions[key];
      if(!addition||typeof addition.text!=='string'||typeof addition.step!=='string')return;
      if(!current&&key==='usda'){
        copy.topics.usda={title:labels[tag].usda||'USDA · FoodData Central',text:addition.text,steps:[addition.step],links:['usda','foodDiscovery']};
        return;
      }
      if(!current)return;
      if(typeof current.text==='string'&&!current.text.includes(addition.text))current.text=(current.text.trim()+' '+addition.text).trim();
      if(!Array.isArray(current.steps))current.steps=[];
      if(!current.steps.includes(addition.step))current.steps.push(addition.step);
    });
  });
  var reviewed=window.CalorieTokenHeadingRepairSiteHelp;
  if(reviewed)Object.keys(reviewed).forEach(function(tag){
    var copy=cfg.copy[tag],current=reviewed[tag];if(!copy||!current||!current.topics)return;
    if(!copy.topics)copy.topics={};
    ['app','test','account','export','move','usecases','docs','community','contribute','showcases','siteNavigation','troubleshoot'].forEach(function(key){
      var topic=current.topics[key];
      if(topic&&typeof topic.title==='string'&&typeof topic.text==='string')copy.topics[key]=Object.assign({},topic);
    });
    Object.assign(copy.linkLabels,current.linkLabels||{});
    if(typeof current.updatedLabel==='string')copy.updatedLabel=current.updatedLabel;
  });
  // The reviewed site account answer must also retain the current sign-in guidance.
  Object.keys(cfg.copy).forEach(function(tag){
    var current=cfg.copy[tag].topics&&cfg.copy[tag].topics.account,addition=topics&&topics[tag]&&topics[tag].account;
    if(!current||!addition)return;
    if(typeof current.text==='string'&&!current.text.includes(addition.text))current.text+=' '+addition.text;
    if(!Array.isArray(current.steps))current.steps=[];
    if(!current.steps.includes(addition.step))current.steps.push(addition.step);
  });
  Object.keys(cfg.copy).forEach(function(tag){var topic=cfg.copy[tag].topics&&cfg.copy[tag].topics.usda;if(topic&&Array.isArray(topic.links)&&!topic.links.includes('contributeUsda'))topic.links.push('contributeUsda');});
  if(window.CalorieTokenMarkets)window.CalorieTokenMarkets.patchHelp(cfg);
})();
