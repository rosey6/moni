import { test } from 'node:test';
import assert from 'node:assert/strict';
import { financeText, financeFormat, financeLocale } from '../../src/app/i18nFinance.js';
import { getNotifications } from '../../src/domain/notifications.js';
test('traduit les libellés, substitutions et notifications financières', () => {
 const state={currency:'EUR', preferences:{language:'en',alerts:{budget:false,subscriptions:true,savings:false}},allocations:{},budget:0,subscriptions:[{name:'Test',amount:2,billingDay:15,includedIn:null}],transactions:[],goals:[]};
 assert.equal(financeText(state,'Créer un objectif'),'Create a goal');
 assert.equal(financeText(state,'Accueil'),'Home');
 assert.equal(financeText(state,'Préférences générales'),'General preferences');
 assert.equal(financeFormat(state,'Montant ({currency})',{currency:'EUR'}),'Amount (EUR)');
 assert.equal(financeLocale(state),'en-US');
 assert.match(getNotifications(state,new Date(2026,0,14))[0].text,/scheduled for/);
 state.preferences.language='fr'; assert.equal(financeText(state,'Créer un objectif'),'Créer un objectif');
});
