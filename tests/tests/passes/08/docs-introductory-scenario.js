/*
 * Copyright 2017 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//
// tests to cover the introductory scenario laid out in the docs
//
const ROOT = process.env.TEST_ROOT,
      path = require('path'),
      common = require(path.join(ROOT, 'lib/common')),
      openwhisk = require(path.join(ROOT, 'lib/openwhisk')),
      ui = require(path.join(ROOT, 'lib/ui')),
      badges = require(path.join(ROOT, '../app/plugins/modules/composer/lib/badges.js')),
      fs = require('fs'),
      util = require('util'),
      assert = require('assert'),
      //sharedURL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
      keys = ui.keys,
      cli = ui.cli,
      sidecar = ui.sidecar,
      inputs = [
          { appName: 'hello',                          // name of our first composition
            expectedStructa: {'msg':'hello composer!'} // invoking appName1 with -p name composer
          },
          { appName: 'if',
            actions: [ 'welcome', 'authenticate', 'login' ],
            expectedStructa: { html: "<html><body>please say the magic word.</body></html>" },
            expectedStructb: { html: "<html><body>welcome if-combinator!</body></html>" }
          },
          { appName: 'try',
            actions: [ 'validate' ],
            expectedStructa: { ok: true },
            expectedStructb: { ok: false }
          },
          { appName: 'retain',
            expectedStructa: { text: "hello try!" },
            expectedStructb: { ok: false }
          },
          { appName: 'let',
            expectedStructa: { ok: true }
          }
      ]

/** fetch source code for the app */
const src = app => fs.readFileSync(path.join(ROOT, '../app/plugins/modules/composer/@demos/', `${app}.js`)).toString()

// hardcode for now... we need to generate this every time
const fsm = {
    hello: {
        "type": "sequence",
        "components": [{
            "type": "function",
            "function":{
              "exec": {
                "kind": "nodejs:default",
                "code": "args => ({msg: `hello ${args.name}!`})"
              }
            }            
        }]
    },
    if: {
        "type": "if",
        "test": {
                "type": "action",
                "name": "/_/authenticate"
            },
            "consequent": {
                "type": "action",
                "name": "/_/welcome"
            },
            "alternate": {
                "type": "action",
                "name": "/_/login"
            }
    },
    try: {
        "type": "try",
            "body": {
                "type": "action",
                "name": "/_/validate"
            },
            "handler": {
                "type": "function",
                "function":{"exec": {
                    "kind": "nodejs:default",
                    "code": "args => ({ ok: false })"
                }}
            }
    },
    retain: {
        
            "type": "try",
            "body": {
              "type": "sequence",
              "components":[
                {
                    "type": "retain",
                    "components": [{
                        "type": "action",
                        "name": "/_/validate"
                    }]
                }, {
                    "type": "function",
                    "function":{"exec": {
                        "kind": "nodejs:default",
                        "code": "args => ({ text: new Buffer(args.params.str, 'base64').toString() })"
                    }}
                }
              ]
            },
            "handler": {
                "type": "function",
                "function":{"exec": {
                    "kind": "nodejs:default",
                    "code": "args => ({ ok: false })"
                }}
            }
        
    },
    let: { 
        "type": "sequence",
        "components":[
        {
            "type": "let",
            "declarations": {
                "secret": 42
            },
            "components": [{
                "type": "function",
                "function":{"exec": {
                    "kind": "nodejs:default",
                    "code": "_ => ({ ok: secret === 42 })"
                }}
            }]
        }, {
            "type": "function",
            "function":{"exec": {
                "kind": "nodejs:default",
                "code": "_ => ({ ok: (typeof secret === 'undefined') })"
            }}
        }
        ]        
    }
}

/**
 * Invariants over the wskflow graph
 *
 */
const EMPTY = Promise.resolve({ value: [] }) // mimic an empty return value from client.elements
const graph = {
    /**
     * Invariant: graph has a given number of task and total nodes
     *
     */
    hasNodes: ({tasks:expectedTasks=0, total:expectedTotal=0, deployed:expectedDeployed=0, values:expectedValues=0}) => app => {
        const { client } = app
        // here we intentionally use just expectedX, because undefined and 0 are treated the same
        return client.waitUntil(() => Promise.all([!expectedTasks ? EMPTY : client.elements('#wskflowSVG .node.Task'),
                                                   !expectedTotal ? EMPTY : client.elements('#wskflowSVG .node.leaf'),
                                                   !expectedValues ? EMPTY : client.elements('#wskflowSVG .node.let'),
                                                   !expectedDeployed ? EMPTY : client.elements('#wskflowSVG .node.leaf[data-deployed="deployed"]')
                                                  ])
                                .then(([{value:actualTasks}, {value:actualTotal}, {value:actualValues}, {value:actualDeployed}]) => {
                                    return actualTasks.length === expectedTasks
                                        && actualTotal.length === expectedTotal
                                        && actualValues.length === expectedValues
                                        && actualDeployed.length === expectedDeployed
                                }))
            .then(() => app) // allow for further composition
    }
}

/** turn array of strings into map from key:true */
const toMap = A => A.reduce((M, item) => {
    M[item] = true
    return M
}, {})

/** verify that M2 contains a key not in M1 */
const somethingNew = (M1, M2) => {
    for (let key in M2) {
        if (! (key in M1)) {
            return true
        }
    }
    return false
}

/**
 * Common composer operations
 *
 */
const composer = {
    countSessions: (app, name) => {
        return cli.do(`session list ${name}`, app)
	    .then(cli.expectOKWithCustom({ passthrough: true }))
            .then(N => app.client.getText(`${ui.selectors.OUTPUT_N(N)} .entity.session .activationId .clickable`))
            .then(toMap)
    },
    getSessions: (app, nDone, { cmd='session list', expect=[] }) => {
        return cli.do(cmd, app)
	    .then(cli.expectOKWithCustom({ passthrough: true }))
            .then(N => {
                if (nDone > 0) {
                    return app.client.getText(`${ui.selectors.OUTPUT_N(N)} .entity.session .entity-name .clickable`)
                        .then(done => !util.isArray(done) ? [done] : done)      // make sure we have an array
                        .then(done => {                                         // validate expect, which is a subset of the expected done list
                            return Promise.all(expect.map(e => assert.ok(done.find(d => d === e)))) // is each expected in the done list?
                                .then(() => done) // passthrough
                        })
                        .then(done => {
                            // validate nDone
                            if (done.length < nDone) {
                                return app.client.getText(`${ui.selectors.OUTPUT_N(N)} .entity.session .activationId .clickable`)
                                    .then(activationIds => {
                                        // we have a fatal error, but first let's log some bits
                                        console.error(done)
                                        console.error(activationIds)
                                        assert.ok(done.length >= nDone)
                                    })
                            }
                        })
                        .then(() => N) // allow further composition using N, the command index
                }

                return N // allow further composition using N, the command index
            })
    }
}

describe('Intro demo scenario', function() {
    before(common.before(this))
    after(common.after(this))

    it('should have an active repl', () => cli.waitForRepl(this.app))

    // app init
    /*{
        const cmd = `app init --url ${sharedURL}`
        it(cmd, () => cli.do(cmd, this.app)
            .then(cli.expectOKWithCustom({expect: 'Successfully initialized the required services. You may now create compositions.'}))
           .catch(common.oops(this)))
    }

    // app init --cleanse
    const cleanseRedis = () => {
        const cmd = `app init --cleanse --url ${sharedURL}`
        it(cmd, () => cli.do(cmd, this.app)
            .then(cli.expectOKWithCustom({expect: 'Successfully initialized and reset the required services. You may now create compositions.'}))
           .catch(common.oops(this)))
    }*/

    // session list, expect empty
    /*const expectNoSessions = () => {
        // expect 0 live and 0 done, since we just did an app init --cleanse
        const cmd = 'session list',
              nLive = 0,
              nDone = 0
        it(`should list sessions via ${cmd} nLive=${nLive} nDone=${nDone}`, () => {
            return composer.getSessions(this.app, nLive, nDone, { cmd })
                .catch(common.oops(this))
        })
    }*/

    //cleanseRedis()
    //expectNoSessions()

    // app create
    {
        const { appName:appName1 } = inputs[0]
        const cmd = `app create ${appName1} @demos/${appName1}.js -a turkey shoot`
        it(cmd, () => cli.do(cmd, this.app)
	   .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName1))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 1, total: 3}))

           // switch to fsm tab
           .then(() => this.app.client.click(ui.selectors.SIDECAR_MODE_BUTTON('fsm')))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm[appName1]))

           // switch to annotations tab
           .then(() => this.app.client.click(ui.selectors.SIDECAR_MODE_BUTTON('annotations')))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectSubset({"turkey": "shoot"}))

           // switch to parameters tab; in v2 this isn't relevant
           /*.then(() => this.app.client.click(ui.selectors.SIDECAR_MODE_BUTTON('parameters')))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectSubset({"_actions": v => util.isArray(v) && v.length>0})) // expect some list value*/

           .catch(common.oops(this)))
    }

    // app create, 409 conflict
    {
        const { appName:appName1 } = inputs[0]
        const cmd = `app create ${appName1} @demos/${appName1}.js`
        it(`${cmd} expect conflict`, () => cli.do(cmd, this.app)
            .then(cli.expectError(409, 'resource already exists'))
           .catch(common.oops(this)))
    }

    // app invoke hello -p name composer
    const invokeHello = () => {
        const { appName:appName1, expectedStructa:expectedStruct1 } = inputs[0]
        const cmd = `app invoke ${appName1} -p name composer`
        return cli.do(cmd, this.app)
	    .then(cli.expectOK)
            .then(sidecar.expectOpen)
            .then(sidecar.expectShowing(appName1))
            .then(app => app.client.waitUntil(() => {
                return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                    .then(ui.expectStruct(expectedStruct1))
            }))
            .then(() => this.app.client.getText(ui.selectors.SIDECAR_ACTIVATION_ID)) // return the activationId
            .catch(common.oops(this))
    }

    // cleanse redis after the invoke, and double-check we have no sessions
    //invokeHello()
    //cleanseRedis()
    //expectNoSessions()

    // invoke hello again, and expect the session list to show just it
    {
        const { appName:appName1 } = inputs[0]

        it('should invoke hello and show one more session than before', () => invokeHello()
           .then(activationId => ui.waitForSession(this.app, activationId, { name: appName1 }))
           .catch(common.oops(this)))
    }

    // session result
    {
        const { appName:appName1, expectedStructa:expectedStruct1 } = inputs[0]

        it(`should display result in repl with session result`, () => invokeHello()
           .then(activationId => ui.waitForSession(this.app, activationId, { name: appName1 })
                 .then(() => cli.do(`session result ${activationId}`, this.app)))
           .then(cli.expectOKWithCustom({ selector: 'code' }))
           .then(selector => this.app.client.getText(selector))
           .then(ui.expectStruct(expectedStruct1))
           .catch(common.oops(this)))
    }

    // app preview hello.js
    {
        const { appName:appName1 } = inputs[0]
        const cmd = `app preview @demos/${appName1}.js`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(`${appName1}.js`))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 1, total: 3}))

           // visit fsm tab
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="fsm"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm.hello))

           // visit code tab
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="source"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(code => assert.equal(code.replace(/\s+/g,''), src(appName1).replace(/\s+/g,'')))           

           .catch(common.oops(this)))
    }

    // session get
    {
        const { appName:appName1, expectedStructa:expectedStruct1 } = inputs[0]

        it(`should display result in sidecar with session get`, () => invokeHello()
           .then(activationId => ui.waitForSession(this.app, activationId, { name: appName1 })
                 .then(() => cli.do(`session get ${activationId}`, this.app)))
           .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName1))
           .then(app => app.client.waitUntil(() => {
               return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct1))
           }))
           .catch(common.oops(this)))
    }

    // app preview if.js
    {
        const { appName:appName2 } = inputs[1]
        const cmd = `app preview @demos/${appName2}.js`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(`${appName2}.js`))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 3, total: 6, deployed: 0}))

           // visit fsm tab
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="fsm"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm[appName2]))

           // visit code tab
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="source"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(code => assert.equal(code.replace(/\s+/g,''), src(appName2).replace(/\s+/g,'')))

           .catch(common.oops(this)))
    }

    // create if's actions
    {
        const { actions:actionsFor2 } = inputs[1]
        actionsFor2.forEach(action => {
            const cmd = `let ${action} = @demos/${action}.js`
            it(cmd, () => cli.do(cmd, this.app)
	        .then(cli.expectOK)
               .then(sidecar.expectOpen)
               .then(sidecar.expectShowing(action))
               .catch(common.oops(this)))
        })
    }

    // app create if.js, confirming deployed decoration shows up
    {
        const { appName:appName2 } = inputs[1]
        const cmd = `app create ${appName2} @demos/${appName2}.js`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName2))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 3, total: 6, deployed: 3})) // <---- deployed had better be 3 now
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="fsm"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm[appName2]))
           .catch(common.oops(this)))
    }

    // app invoke if
    {
        const { appName:appName2, expectedStructa:expectedStruct2a } = inputs[1]
        const cmd = `app invoke ${appName2}`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName2))
           .then(app => app.client.waitUntil(() => {
                   return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct2a))
           }))
           .catch(common.oops(this)))
    }

    //  app invoke if -p token secret -p name if-combinator
    {
        const { appName:appName2, expectedStructb:expectedStruct2b } = inputs[1]
        const cmd = `app invoke ${appName2} -p token secret -p name if-combinator`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName2))
           .then(app => app.client.waitUntil(() => {
               return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct2b))
           }))
           .catch(common.oops(this)))
    }

    // session list
    {
        // expect 3 done sessions, and that the done list contain appName2
        const { appName:appName1 } = inputs[0]
        const { appName:appName2 } = inputs[1]
        const cmd = 'session list --limit 200',
              expected = [ appName1, appName2 ], // appName1 and appName2 had both better be in the list
              nDone = 3
        it(`should list sessions via ${cmd} nDone=${nDone}`, () => {
            return composer.getSessions(this.app, nDone, { cmd, expected })
                .catch(common.oops(this))
        })
    }

    // session list with name filter
    {
        // expect 1 done sessions, and that the done list contain appName1
        const { appName:appName1 } = inputs[0]
        const cmd = `session list ${appName1}`,
              expected = [ appName1 ], // appName1 had better be in the list
              nDone = 1
        it(`should list sessions via ${cmd} nDone=${nDone}`, () => {
            return composer.getSessions(this.app, nDone, { cmd, expected })
                .catch(common.oops(this))
        })
    }

    // session list with name filter (variant)
    {
        // expect 1 done sessions, and that the done list contain appName1
        const { appName:appName2 } = inputs[1]
        const cmd = `session list --name ${appName2}`,
              expected = [ appName2 ], // appName2 had better be in the list
              nDone = 2
        it(`should list sessions via ${cmd} nDone=${nDone}`, () => {
            return composer.getSessions(this.app, nDone, { cmd, expected })
                .catch(common.oops(this))
        })
    }

    // app preview try.js
    {
        const { appName:appName3 } = inputs[2]
        const cmd = `app preview @demos/${appName3}.js`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(`${appName3}.js`))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 2, total: 4, deployed: 0}))

           // visit fsm tab
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="fsm"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm[appName3]))

           // visit code tab
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="source"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(code => assert.equal(code.replace(/\s+/g,''), src(appName3).replace(/\s+/g,'')))
           
           .catch(common.oops(this)))
    }

    // create try's actions
    {
        const { actions:actionsFor3 } = inputs[2]
        actionsFor3.forEach(action => {
            const cmd = `let ${action} = @demos/${action}.js`
            it(cmd, () => cli.do(cmd, this.app)
	        .then(cli.expectOK)
               .then(sidecar.expectOpen)
               .then(sidecar.expectShowing(action))
               .catch(common.oops(this)))
        })
    }

    // app create try.js, confirming deployed decoration shows up
    {
        const { appName:appName3 } = inputs[2]
        const cmd = `app create ${appName3} @demos/${appName3}.js`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName3))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 2, total: 4, deployed: 1})) // <---- deployed had better be 1 now
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="fsm"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm[appName3]))
           .catch(common.oops(this)))
    }

    //  app invoke try -p str aGVsbG8gdHJ5IQ==
    {
        const { appName:appName3, expectedStructa:expectedStruct3a } = inputs[2]
        const cmd = `app invoke ${appName3} -p str aGVsbG8gdHJ5IQ==`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName3))
           .then(app => app.client.waitUntil(() => {
               return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct3a))
           }))
           .catch(common.oops(this)))
    }

    //  app invoke try -p str bogus
    {
        const { appName:appName3, expectedStructb:expectedStruct3b } = inputs[2]
        const cmd = `app invoke ${appName3} -p str bogus`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName3))
           .then(app => app.client.waitUntil(() => {
               return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct3b))
           }))
           .catch(common.oops(this)))
    }

    // session get --last try
    {
        // expect 1 done sessions, and that the done list contain appName3
        const { appName:appName3, expectedStructb:expectedStruct3b } = inputs[2]
        const cmd = 'session get --last try'
        it(cmd, () => cli.do(cmd, this.app)
            .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName3))
           .then(app => app.client.waitUntil(() => {
                   return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct3b))
           }))
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="visualization"]'))
           .then(() => this.app)
           .then(graph.hasNodes({tasks: 2, total: 4/*, deployed: 2*/}))
           .catch(common.oops(this)))
    }


    // app create retain.js
    {
        const { appName:appName4 } = inputs[3]
        const cmd = `app create ${appName4} @demos/${appName4}.js`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName4))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 3, total: 7, deployed: 1})) // <---- deployed had better be 1
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="fsm"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm[appName4]))
           .catch(common.oops(this)))
    }

    //  app invoke retain -p str aGVsbG8gdHJ5IQ==
    {
        const { appName:appName4, expectedStructa:expectedStruct4a } = inputs[3]
        const cmd = `app invoke ${appName4} -p str aGVsbG8gdHJ5IQ==`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName4))
           .then(app => app.client.waitUntil(() => {
               return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct4a))
           }))
           .catch(common.oops(this)))
    }

    //  app invoke retain -p str bogus
    {
        const { appName:appName4, expectedStructb:expectedStruct4b } = inputs[3]
        const cmd = `app invoke ${appName4} -p str bogus`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName4))
           .then(app => app.client.waitUntil(() => {
               return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct4b))
           }))
           .catch(common.oops(this)))
    }


    // app create let.js
    {
        const { appName:appName5 } = inputs[4]
        const cmd = `app create ${appName5} @demos/${appName5}.js`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName5))
           .then(sidecar.expectBadge(badges.composerLib))
           .then(graph.hasNodes({tasks: 2, total: 5, deployed: 0, value: 1}))
           .then(() => this.app.client.click('#sidecar .sidecar-bottom-stripe-button[data-mode="fsm"]'))
           .then(() => this.app.client.getText('#sidecar .sidecar-content .action-content code'))
           .then(ui.expectStruct(fsm[appName5]))
           .catch(common.oops(this)))
    }

    //  app invoke retain -p str bogus
    {
        const { appName:appName5, expectedStructa:expectedStruct5a } = inputs[4]
        const cmd = `app invoke ${appName5}`
        it(cmd, () => cli.do(cmd, this.app)
	    .then(cli.expectOK)
           .then(sidecar.expectOpen)
           .then(sidecar.expectShowing(appName5))
           .then(app => app.client.waitUntil(() => {
               return app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .activation-result`)
                   .then(ui.expectStruct(expectedStruct5a))
           }))
           .catch(common.oops(this)))
    }

    // open grid view to app `grid appName`
    /*{
        inputs.forEach( ({appName,actions=[]}) => {
            const cmd = `grid ${appName}`,
                  cmd2 = `grid ${appName} -a`,
                  gridForAction = action => `${ui.selectors.SIDECAR} .custom-content .grid[data-action-name="${action}"]`

            // if this app has actions/tasks, then `grid appName` should show them
            if (actions.length > 0) {
                it(cmd, () => cli.do(cmd, this.app)
	            .then(cli.expectOK)
                   .then(sidecar.expectOpen)
                   .then(sidecar.expectShowing(appName))
                   .then(() => Promise.all(actions.map(_ => this.app.client.waitForExist(gridForAction(_)))))
                   .catch(common.oops(this)))
            }

            // grid -a should also include the app itself
            it(cmd2, () => cli.do(cmd2, this.app)
	        .then(cli.expectOK)
               .then(sidecar.expectOpen)
               .then(sidecar.expectShowing(appName))
               .then(() => Promise.all(actions.map(_ => this.app.client.waitForExist(gridForAction(_)))))
               .then(() => this.app.client.waitForExist(gridForAction(appName)))
               .catch(common.oops(this)))
        })
    }*/
})
