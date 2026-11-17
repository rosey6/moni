import { test } from 'node:test';
import assert from 'node:assert/strict';
import { financeState, resetFinanceState, switchCurrency } from '../../src/app/financeState.js';
test('conserve les espaces et montants dans leur devise d’origine', () => {
 resetFinanceState(); financeState.budget=123; financeState.transactions.push({amount:100});
 switchCurrency(financeState,'EUR'); assert.equal(financeState.budget,0); assert.equal(financeState.transactions.length,0);
 financeState.budget=234; switchCurrency(financeState,'XOF'); assert.equal(financeState.budget,123); assert.equal(financeState.transactions[0].amount,100);
 switchCurrency(financeState,'EUR'); assert.equal(financeState.budget,234); assert.throws(()=>switchCurrency(financeState,'INVALID'));
});
