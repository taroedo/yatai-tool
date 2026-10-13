"use strict";
const CONFIG=window.UI_TEST_CONFIG;
const PRODUCTS=CONFIG.products;
const $=id=>document.getElementById(id);
const yen=value=>`${Number(value).toLocaleString("ja-JP")}円`;
const emptyQuantities=()=>Object.fromEntries(PRODUCTS.map(product=>[product.key,0]));
let current={quantities:emptyQuantities(),received:0,moneyStack:[]};
let sales=[];
let sequence=0;
let cancelCandidate=null;
function total(){return PRODUCTS.reduce((sum,product)=>sum+current.quantities[product.key]*product.price,0)}
function validSales(){return sales.filter(sale=>!sale.cancelled)}
function quantityFields(source){return Object.fromEntries(PRODUCTS.map(product=>[product.field,Number(source[product.field]??source.quantities?.[product.key]??0)]))}
function render(){
  const amount=total(),shortage=Math.max(amount-current.received,0),change=Math.max(current.received-amount,0),active=validSales();
  const itemCount=active.reduce((sum,sale)=>sum+PRODUCTS.reduce((count,product)=>count+Number(sale[product.field]||0),0),0);
  const salesAmount=active.reduce((sum,sale)=>sum+sale.total,0);
  PRODUCTS.forEach(product=>{$(`${product.key}Qty`).textContent=current.quantities[product.key]});
  $("received").textContent=yen(current.received);$("total").textContent=yen(amount);$("change").textContent=shortage?`不足 ${yen(shortage)}`:yen(change);$("change").classList.toggle("short",shortage>0);
  $("checkout").disabled=!amount||shortage>0;$("undoMoney").disabled=!current.moneyStack.length;$("clearMoney").disabled=!current.received;$("exactMoney").disabled=!amount;
  $("registerItems").textContent=`${itemCount}点`;$("registerSales").textContent=yen(salesAmount);$("cancelLast").disabled=!active.length;
}
document.querySelectorAll("[data-product]").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.product;current.quantities[key]=Math.max(0,current.quantities[key]+Number(button.dataset.delta));render()}));
document.querySelectorAll("[data-money]").forEach(button=>button.addEventListener("click",()=>{const value=Number(button.dataset.money);current.received+=value;current.moneyStack.push(value);render()}));
$("undoMoney").addEventListener("click",()=>{current.received=Math.max(0,current.received-(current.moneyStack.pop()||0));render()});
$("clearMoney").addEventListener("click",()=>{current.received=0;current.moneyStack=[];render()});
$("exactMoney").addEventListener("click",()=>{current.received=total();current.moneyStack=[];render()});
$("checkout").addEventListener("click",()=>{const amount=total();if(!amount||current.received<amount)return;sequence+=1;const sale={receiptNo:`${CONFIG.receiptPrefix}-${$("registerId").value}-${String(sequence).padStart(4,"0")}`,registerId:$("registerId").value,cashierId:$("cashierId").value,...quantityFields(current),total:amount,received:current.received,change:current.received-amount,cancelled:false};sales.push(sale);current={quantities:emptyQuantities(),received:0,moneyStack:[]};$("notice").textContent=`${sale.receiptNo} 会計完了`;window.setTimeout(()=>{$("notice").textContent=""},2500);render()});
$("cancelLast").addEventListener("click",()=>{cancelCandidate=[...validSales()].reverse()[0];if(!cancelCandidate)return;$("cancelTarget").textContent=`${cancelCandidate.receiptNo}／${yen(cancelCandidate.total)}`;$("cancelReason").selectedIndex=0;$("cancelNote").value="";$("cancelDialog").showModal()});
$("confirmCancel").addEventListener("click",event=>{event.preventDefault();if(!cancelCandidate)return;cancelCandidate.cancelled=true;cancelCandidate.cancelReason=$("cancelReason").value;cancelCandidate.cancelNote=$("cancelNote").value.trim();$("cancelDialog").close();$("notice").textContent=`${cancelCandidate.receiptNo} を取り消しました`;cancelCandidate=null;window.setTimeout(()=>{$("notice").textContent=""},2500);render()});
render();
