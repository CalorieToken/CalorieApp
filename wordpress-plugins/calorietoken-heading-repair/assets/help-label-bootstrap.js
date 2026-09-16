/* Add missing link labels and reviewed topic notes; preserve every current topic and URL. */
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
})();
