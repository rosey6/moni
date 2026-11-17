import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNotifications, nextSubscriptionDate } from '../../src/domain/notifications.js';

const state = () => ({preferences:{alerts:{budget:true,subscriptions:true,savings:true}}, allocations:{rent:100}, budget:200, subscriptions:[{name:'Service',billingDay:31,amount:110,includedIn:'rent'}], transactions:[{type:'expense',category:'rent',date:'2026-02-20',amount:120}], goals:[{id:'g',name:'Projet',target:100,date:'2027-01-01',contributions:[{amount:100}]}]});
test('notifications calculées, préférences et échéances des mois courts', () => {
  const s = state(), now = new Date(2026,1,22);
  assert.equal(nextSubscriptionDate(s.subscriptions[0],now).getDate(),28);
  assert.equal(getNotifications(s,now).length,3);
  s.preferences.alerts.budget=false; s.preferences.alerts.savings=false;
  assert.deepEqual(getNotifications(s,now).map(n=>n.id.split(':')[0]),['subscription']);
  assert.equal(getNotifications(s,new Date(2026,1,1)).length,0);
});

test('les statuts lus sont distincts pour chaque devise', () => {
 const s=state(); const now=new Date(2026,1,22); s.currency='XOF'; const first=getNotifications(s,now).map(n=>n.id); s.currency='EUR'; const second=getNotifications(s,now).map(n=>n.id); assert.notEqual(first[0],second[0]);
});

test('aucun palier pour une épargne libre', () => {
 const s=state(); s.goals=[{id:'free',name:'Libre',mode:'free',target:null,date:null,contributions:[{amount:100}]}];
 assert.equal(getNotifications(s,new Date(2026,1,1)).filter(item=>item.id.startsWith('savings:')).length,0);
});
