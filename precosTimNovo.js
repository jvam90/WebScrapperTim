const puppeteer = require('puppeteer');
const fs = require('fs');
const sql = require('mssql');
var links = recuperarLinks();

const prepararParaTestes = async (page) => {
	// Pass the User-Agent Test.
	const userAgent = 'Mozilla/5.0 (X11; Linux x86_64)' +
	    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';
	  await page.setUserAgent(userAgent);

  // Pass the Webdriver Test.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Pass the Chrome Test.
  await page.evaluateOnNewDocument(() => {
    // We can mock this in as much depth as we need for the test.
    window.navigator.chrome = {
      runtime: {},
      // etc.
    };
  });

  // Pass the Permissions Test.
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    return window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  // Pass the Plugins Length Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'plugins', {
      // This just needs to have `length > 0` for the current test,
      // but we could mock the plugins too if necessary.
      get: () => [1, 2, 3, 4, 5],
    });
  });

  // Pass the Languages Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
}

const opts = {
    headless: false,
    defaultViewport: null,
    args: [
        '--start-maximized',
	    '--no-sandbox',
    ]
};


function recuperarLinks(){
	var links = fs.readFileSync('linksTim.txt', 'utf-8').split('\r\n');
	var indices = [];
	var objs = [];
	for(var i = 0; i < links.length; i++){
		if(links[i].length == 9 || links[i].length == 8){
			indices.push(i);
		}
	}
	for(var i = 0; i < indices.length; i++){
		var obj = {}
		obj.cep = links[indices[i]];
		obj.links = [];
		if(i == indices.length - 1){
			for(var j = indices[i] + 1; j < links.length; j++){
				if(links[j] != ''){
					obj.links.push(links[j]);				
				}
			}	
		}else{
			for(var j = indices[i] + 1; j < indices[i + 1]; j++){
				obj.links.push(links[j]);
			}	
		}
		objs.push(obj);
	}
	return objs;
}

puppeteer.launch(opts).then(async browser => {
	const page = await browser.newPage();
    //tirando o timeout
    await page.setDefaultNavigationTimeout(0);	
	var list = [];
	await prepararParaTestes(page);
    for(let link of links){
		for(let url of link.links){
			try{
				if(url != '' && url != '\r'){					
					console.log("Cep: " + link.cep);
					console.log("Link: " + url);
					var dadosAjustados;
					if(url.includes('apenas-aparelho')){
						await page.goto(url);
						await page.waitFor(15000);
						await page.click('a[class="regional"]')
	        			await page.waitFor('input[id="zipcode"]')
			        	await page.type('input[id="zipcode"]', link.cep)
						await page.click('label[for="client_check_2"]')
						await page.click('input[data-ng-click="submitInfos()"]')
						await page.waitFor(15000)
						let aparelho = await page.evaluate(function () {
								return Array.from(document.querySelectorAll('.offer-title .subtitle')).map(element => element.innerText);
		                    });
						let precoAparelho = await page.evaluate(function () {
								return Array.from(document.querySelectorAll('.price-value')).map(element => element.innerText);
		                    });					
                     	dadosAjustados = await montarDadosTimSomenteAparelho(aparelho[0], precoAparelho[0], link.cep);
						//console.log(dadosAjustados)
						await Promise.all(dadosAjustados.map(obj => salvarBanco(obj)));
					}else{
						await page.goto(url);
						await page.waitFor(15000);
						await page.click('a[class="regional"]')
	        			await page.waitFor('input[id="zipcode"]')
			        	await page.type('input[id="zipcode"]', link.cep)
						await page.click('label[for="client_check_2"]')
						await page.click('input[data-ng-click="submitInfos()"]')
						await page.waitFor(15000)
						let aparelho = await page.evaluate(function () {
							return Array.from(document.querySelectorAll('.offer-title .subtitle')).map(element => element.innerText);
		                });
						let precoAparelho = await page.evaluate(function () {
							return Array.from(document.querySelectorAll('.price-value')).map(element => element.innerText);
		                });
						let plano = await page.evaluate(function () {
							return Array.from(document.querySelectorAll(".plan-widget .subtitle")).map(element => element.innerText);	
						});
						let precoPlano = await page.evaluate(function(){
							return Array.from(document.querySelectorAll('.plan-price .price')).map(element => element.innerText)
						});							
						dadosAjustados = await montarObj(aparelho[0], precoAparelho[0], plano[0], precoPlano[0], link.cep);						
						//console.log(dadosAjustados)
						await Promise.all(dadosAjustados.map(obj => salvarBanco(obj)));
					}
					console.log('\r\n');
				}
			}catch(e){
				console.log(e);
			}
		}
	}   
    //por fim, vai fechar o navegador
    await browser.close();
});



async function salvarBanco(dados){
	const pool = new sql.ConnectionPool({
	  user: 'RegionalNE',
	  password: 'RegionalNEvivo2019',
	  server: '10.238.176.136',  
	  database: 'SOL'
	});
	pool.connect().then(function(){
		const request = new sql.Request(pool);
		const insert = "insert into [SOL].[dbo].[PRECOS_CONCORRENCIA_TIM_AUX] ([APARELHO], [PRECO_APARELHO], [PLANO], [PRECO_PLANO], [UF], [CEP], [DATA_CARGA]) " +
				" values ('" + dados.aparelho + "', '" + dados.precoAparelho + "', '" + dados.plano + "', '" + dados.precoPlano + "', '" + dados.uf + "','" + dados.cep + "', convert(date, getdate(),101))" ;
		request.query(insert).then(function(recordset){
			console.log('Dado inserido');			
			pool.close();
		}).catch(function(err){
			console.log(err);
			pool.close();
		})
	}).catch(function(err){
		console.log(err);
	});   	   
}

async function excluirBanco(){
	const pool = new sql.ConnectionPool({
	  user: 'RegionalNE',
	  password: 'RegionalNEvivo2019',
	  server: '10.238.176.136',  
	  database: 'SOL'
	});
	pool.connect().then(function(){
		const request = new sql.Request(pool);
		const del = "DELETE FROM [SOL].[dbo].[PRECOS_CONCORRENCIA_TIM_AUX]";
		request.query(del).then(function(recordset){
			console.log('Dados removidos');			
			pool.close();
		}).catch(function(err){
			console.log(err);
			pool.close();
		})
	}).catch(function(err){
		console.log(err);
	});   	   
}

function montarObj(aparelho, precoAparelho, plano, precoPlano, cep) {
    var obj = {};	
	var retorno = [];
	obj.aparelho = aparelho.replace("NOTE9", "NOTE 9").replace("Note9", "Note 9").replace("TIM", "");
	
	if(precoAparelho.includes("De")){
		let precosplit = precoAparelho.split("\n");
		obj.precoAparelho = precosplit[1].replace(' ', '').trim();
	}else{
		obj.precoAparelho = precoAparelho.replace(' ', '').trim();	
	}
	obj.plano = plano;
	obj.precoPlano = "R$" + precoPlano + "/Mensal";
	obj.cep = cep.trim().replace(' ', '').replace('\r\n', '').replace('\r', '').replace('\n', '');
	console.log(obj);
	if (cep.includes('60170250')) {
	    obj.uf = 'CE';
    } else if (cep.includes('45600760')) {
        obj.uf = 'BA';
    } else if (cep.includes('51011051')){
        obj.uf = 'PE'
    }else{
		obj.uf = 'SP';
	}
	console.log(obj);
	if(obj.plano != ''){
		retorno.push(obj);			
	}
    return retorno;
}

function montarDadosTimSomenteAparelho(aparelho, preco, cep) {
    var dadosAjustados = [];
	var obj = {};
	console.log('Aparelho: ' + aparelho);
	console.log('Preço: ' + preco);
	obj.aparelho = aparelho.trim().replace('\r\n', '').replace('\r', '').replace('\n', '').replace("NOTE9", "NOTE 9").replace("Note9", "Note 9");
 	obj.plano = "Somente Aparelho"
	obj.precoPlano = 'R$0,00';
	if(preco.includes("De")){
		let precosplit = preco.split("\n");
		obj.precoAparelho = precosplit[1].replace(' ', '').trim();
	}else{
		obj.precoAparelho = preco.trim().replace(' ', '').replace('\r\n', '').replace('\r', '').replace('\n', '');
	}
	obj.cep = cep.trim().replace('\r\n', '').replace('\r', '').replace('\n', '');
	if (cep.includes('60170250')) {
	    obj.uf = 'CE';
    } else if (cep.includes('45600760')) {
        obj.uf = 'BA';
    } else if (cep.includes('51011051')){
        obj.uf = 'PE'
    }else{
		obj.uf = 'SP';
	}	
	console.log(obj);
	dadosAjustados.push(obj);
    return dadosAjustados;
}

