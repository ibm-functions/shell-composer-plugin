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

const fs = require('fs'),
      path = require('path'),
      ROOT = process.env.TEST_ROOT,
      common = require(path.join(ROOT, 'lib/common')),
      openwhisk = require(path.join(ROOT, 'lib/openwhisk')),
      ui = require(path.join(ROOT, 'lib/ui')),
      badges = require(path.join(ROOT, '../app/plugins/modules/composer/lib/badges.js')),
      cli = ui.cli,
      sidecar = ui.sidecar,
      //sharedURL = process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      {
          input,
          composerInput,
          composerErrorInput,
          verifyNodeExists,
          verifyNodeExistsById,
          verifyEdgeExists,
          verifyOutgoingEdgeExists,
          verifyNodeLabelsAreSane,
          verifyTheBasicStuff
      } = require('../../../lib/composer-viz-util')

/**
 * Define the input files
 *
 */
const fsm = input('fsm.json'), fsmStruct = JSON.parse(fs.readFileSync(fsm.path).toString()),
      baseComposerInputs = [ composerInput('composer1.js'), composerInput('composer2.js'), composerInput('composer3.js'),
                             composerInput('composer4.js'), composerInput('composer5.js')],
      seq = composerInput('seq.js'),
      If = composerInput('if.js'),
      whileSeq = composerInput('while-seq.js'),
      retry5Times = composerInput('retry-5-times.js'),
      demo = composerInput('demo.js'),
      demoRetain = composerInput('demo-retain.js'),
      mask = composerInput('mask.js'),
      requireAbsolute = composerInput('require-absolute.js'),
      requireRelative = composerInput('require-relative.js'),
      fsRead = composerInput('fs-read.js'),
      addSubscription = composerErrorInput('addSubscription.js')

/**
 * Here starts the test
 *
 */
describe('show the composer visualization without creating openwhisk assets', function() {
    before(common.before(this))
    after(common.after(this))

    it('should have an active repl', () => cli.waitForRepl(this.app))

    it('should preview an empty composition', () => cli.do(`app preview data/composer-source/empty.js`, this.app)
       .then(verifyTheBasicStuff('empty.js', 'composerLib'))
       .then(verifyEdgeExists('Entry', 'Exit'))
       .catch(common.oops(this)))

    /** test: load an FSM */
    const syns = ['preview', 'app viz', 'app preview', 'wsk app viz', 'wsk app preview']
    syns.forEach(cmd => {
        it(`show visualization via ${cmd} from FSM file ${fsm.path}`, () => cli.do(`${cmd} ${fsm.path}`, this.app)
            .then(verifyTheBasicStuff(fsm.file, 'fsm'))
           .then(verifyNodeExists('foo1'))
           .then(verifyNodeExists('foo2'))
           .then(verifyNodeExists('foo3'))
           .then(verifyEdgeExists('Entry', 'foo1'))
           .then(verifyEdgeExists('foo1', 'foo2'))
           .then(verifyEdgeExists('foo2', 'foo3'))
           .then(verifyEdgeExists('foo3', 'Exit'))
           .catch(common.oops(this)))
    })

    /** test: app preview on its own should show usage */
    it(`should show usage for "app preview"`, () => cli.do('app preview', this.app)
       .then(cli.expectError(497)) // 497 insufficient required parameters
       .catch(common.oops(this)))

    /** test: load an FSM, but show the raw fsm */
    it(`show raw FSM from FSM file ${fsm.path}`, () => cli.do(`app viz --fsm ${fsm.path}`, this.app)
      .then(cli.expectOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing(fsm.file))
       .then(app => app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .action-source`))
       .then(ui.expectStruct(fsmStruct))
       .catch(common.oops(this)))

    /** test: ibid, but alternate placement of --fsm on command line */
    it(`show raw FSM from FSM file ${fsm.path}, alterate option placement`, () => cli.do(`app viz ${fsm.path} --fsm`, this.app)
      .then(cli.expectOK)
      .then(sidecar.expectOpen)
      .then(sidecar.expectShowing(fsm.file))
       .then(app => app.client.getText(`${ui.selectors.SIDECAR_CONTENT} .action-source`))
       .then(ui.expectStruct(fsmStruct))
       .catch(common.oops(this)))

    /** tests: we have a bunch of variants of a simple input js file; here we iterate over the variants */
    baseComposerInputs.forEach(input => {
        it(`show visualization from javascript source ${input.path}`, () => cli.do(`app viz ${input.path}`, this.app)
           .then(verifyTheBasicStuff(input.file, 'composerLib'))
           .then(verifyNodeExists('RandomError', false)) // is not deployed
           .then(verifyEdgeExists('Entry', 'Try-Catch'))
           .then(verifyEdgeExists('Try-Catch', 'Exit'))
           .catch(common.oops(this)))
    })

    /*it('should initialize composer', () => cli.do(`app init --url ${sharedURL} --cleanse`, this.app) // cleanse important here for counting sessions in `sessions`
        .then(cli.expectOKWithCustom({expect: 'Successfully initialized and reset the required services. You may now create compositions.'}))
       .catch(common.oops(this)))*/

    /** test: sequence js file */
    it(`show visualization from javascript source ${seq.path}`, () => cli.do(`app viz ${seq.path}`, this.app)
       .then(verifyTheBasicStuff(seq.file, 'composerLib'))
       .then(verifyNodeExists('seq1'))
       .then(verifyNodeExists('seq2'))
       .then(verifyNodeExists('seq3'))
       .then(verifyEdgeExists('seq1', 'seq2'))
       .then(verifyEdgeExists('seq2', 'seq3'))
       .catch(common.oops(this)))

    /** test: viz, then create with no args, testing for handling of implicit entity */
    it(`should create with implicit entity`, () => cli.do('app create', this.app)
       .then(verifyTheBasicStuff(seq.file, 'composerLib'))
       .then(verifyNodeExists('seq1', false)) // not deployed
       .then(verifyNodeExists('seq2', false)) // not deployed
       .then(verifyNodeExists('seq3', false)) // not deployed
       .then(verifyEdgeExists('seq1', 'seq2'))
       .then(verifyEdgeExists('seq2', 'seq3'))
       .catch(common.oops(this)))

    /** test: preview wookiechat */
    it(`show visualization from javascript source ${seq.path}`, () => cli.do(`app preview ./data/composer-wookiechat/app.js`, this.app)
       .then(verifyTheBasicStuff('app.js', 'composerLib'))
       .then(verifyNodeExists('swapi', false)) // not yet deployed
       .then(verifyNodeExists('stapi', false)) // not yet deployed
       .then(verifyNodeExists('validate-swapi', false)) // not yet deployed
       .then(verifyNodeExists('validate-stapi', false)) // not yet deployed
       .then(verifyNodeExists('report-swapi', false)) // not yet deployed
       .then(verifyNodeExists('report-stapi', false)) // not yet deployed
       .then(verifyNodeExists('report-empty', false)) // not yet deployed
       .then(verifyEdgeExists('report-swapi', 'dummy_1'))
       .then(verifyEdgeExists('report-stapi', 'dummy_0'))
       .then(verifyEdgeExists('report-empty', 'dummy_0'))
       .then(verifyEdgeExists('dummy_0', 'dummy_1'))
       .then(verifyEdgeExists('dummy_1', 'Exit'))
       .catch(common.oops(this)))

    /** test: viz, then create with -r, testing for handling of implicit entity and auto-deploy */
    it(`should create wookiechat and dependent actions with implicit entity`, () => cli.do('app update -r', this.app)
       .then(verifyTheBasicStuff('app.js', 'composerLib'))
       .then(verifyNodeExists('swapi', true)) // expect to be deployed
       .then(verifyNodeExists('stapi', true)) // expect to be deployed
       .then(verifyNodeExists('validate-swapi', true)) // expect to be deployed
       .then(verifyNodeExists('validate-stapi', true)) // expect to be deployed
       .then(verifyNodeExists('report-swapi', true)) // expect to be deployed
       .then(verifyNodeExists('report-stapi', true)) // expect to be deployed
       .then(verifyNodeExists('report-empty', true)) // expect to be deployed
       .catch(common.oops(this)))

    /** test: if js file */
    it(`show visualization from javascript source ${If.path}`, () => cli.do(`app viz ${If.path}`, this.app)
       .then(verifyTheBasicStuff(If.file, 'composerLib'))
       .then(verifyNodeExists('seq1'))
       .then(verifyNodeExists('seq2'))
       .then(verifyNodeExists('seq3'))
       .then(verifyNodeExists('seq4'))
       .then(verifyNodeExists('seq5'))
       .then(verifyEdgeExists('Entry', 'isTrue'))
       .then(verifyEdgeExists('seq1', 'seq2'))
       .then(verifyEdgeExists('seq2', 'seq3'))
       .then(verifyEdgeExists('seq4', 'seq5'))
       .then(verifyEdgeExists('seq3', 'dummy_0'))
       .then(verifyEdgeExists('seq5', 'dummy_0'))
       .then(verifyEdgeExists('dummy_0', 'Exit'))
       .catch(common.oops(this)))

    /** test: while with nested sequence, from js file */
    it(`show visualization from javascript source ${whileSeq.path}`, () => cli.do(`app viz ${whileSeq.path}`, this.app)
       .then(verifyTheBasicStuff(whileSeq.file, 'composerLib'))
       .then(verifyNodeExists('seq1'))
       .then(verifyNodeExists('seq2'))
       .then(verifyNodeExists('seq3'))
       .then(verifyNodeExists('cond1'))
       .then(verifyNodeExists('cond2'))
       .then(verifyNodeExists('cond3'))
       .then(verifyNodeExists('action4'))
       .then(verifyEdgeExists('Entry', 'cond1'))
       .then(verifyEdgeExists('cond1', 'cond2'))
       .then(verifyEdgeExists('seq1', 'seq2'))
       .then(verifyEdgeExists('seq2', 'seq3'))
       .then(verifyEdgeExists('seq3', 'cond1'))
       .then(verifyEdgeExists('cond2', 'cond3'))
       .then(verifyEdgeExists('cond3', 'action4'))
       .then(verifyEdgeExists('action4', 'cond3'))
       .then(verifyEdgeExists('cond3', 'Exit'))
       .catch(common.oops(this)))

    /* this one manifests a wskflow bug, disabling for now
    it(`show visualization from javascript source ${retry5Times.path}`, () => cli.do(`app viz ${retry5Times.path}`, this.app)
       .then(verifyTheBasicStuff(retry5Times.file, 'composerLib'))
       .catch(common.oops(this)))
    */

    /** test: from the openwhisk-composer/samples directory */
    it(`show visualization from javascript source ${demo.path}`, () => cli.do(`app viz ${demo.path}`, this.app)
       .then(verifyTheBasicStuff(demo.file, 'composerLib'))
       .then(verifyNodeExists('isNotOne'))
       .then(verifyNodeExists('isEven'))
       .then(verifyNodeExists('DivideByTwo'))
       .then(verifyNodeExists('TripleAndIncrement'))
       .then(verifyOutgoingEdgeExists('TripleAndIncrement', 'isNotOne')) // if we find a way to name the "dummy" node, change this to verifyEdge
       .then(verifyOutgoingEdgeExists('DivideByTwo', 'isNotOne'))        // ibid
       .catch(common.oops(this)))

    /** test: from the openwhisk-composer/samples directory */
    it(`show visualization from javascript source ${demoRetain.path}`, () => cli.do(`app viz ${demoRetain.path}`, this.app)
       .then(verifyTheBasicStuff(demoRetain.file, 'composerLib'))
       .then(verifyNodeExists('DivideByTwo'))
       .then(verifyNodeExists('TripleAndIncrement'))
       .then(verifyEdgeExists('TripleAndIncrement', 'DivideByTwo'))
       .then(verifyOutgoingEdgeExists('DivideByTwo'))
       .catch(common.oops(this)))

    /** test: from the openwhisk-composer/samples directory */
    it(`show visualization from javascript source ${mask.path}`, () => cli.do(`app viz ${mask.path}`, this.app)
       .then(verifyTheBasicStuff(mask.file, 'composerLib'))
       .then(verifyNodeExists('echo1'))
       .then(verifyNodeExists('echo2'))
       .then(verifyEdgeExists('echo1', 'echo2'))
       .catch(common.oops(this)))

    /** test: from the openwhisk-composer/samples directory */
    it(`show visualization from javascript source ${requireAbsolute.path}`, () => cli.do(`app viz ${requireAbsolute.path}`, this.app)
       .then(verifyTheBasicStuff(requireAbsolute.file, 'composerLib'))
       .then(verifyNodeExists('echo1'))
       .then(verifyNodeExists('echo2'))
       .then(verifyEdgeExists('echo1', 'echo2'))
       .catch(common.oops(this)))

    /** test: from the openwhisk-composer/samples directory */
    it(`show visualization from javascript source ${requireRelative.path}`, () => cli.do(`app viz ${requireRelative.path}`, this.app)
       .then(verifyTheBasicStuff(requireRelative.file, 'composerLib'))
       .then(verifyNodeExists('echo1'))
       .then(verifyNodeExists('echo2'))
       .then(verifyEdgeExists('echo1', 'echo2'))
       .catch(common.oops(this)))

    /** test: from the openwhisk-composer/samples directory */
    it(`show visualization from javascript source ${fsRead.path}`, () => cli.do(`app viz ${fsRead.path}`, this.app)
       .then(verifyTheBasicStuff(fsRead.file, 'composerLib'))
       .catch(common.oops(this)))

    it(`fail to show visualization for addSubscription without -e for env var assignment`, () => cli.do(`preview ${addSubscription.path}`, this.app)
       .then(cli.expectError(0, 'SLACK_TOKEN required in environment'))
       .catch(common.oops(this)))

    it(`fail to show visualization for addSubscription with partial -e for env var assignment`, () => cli.do(`preview ${addSubscription.path} -e SLACK_TOKEN yo`, this.app)
       .then(cli.expectError(0, 'CLOUDANT_PACKAGE_BINDING required in environment'))
       .catch(common.oops(this)))

    it(`show visualization for addSubscription using -e for env var assignment`, () => cli.do(`preview ${addSubscription.path} -e SLACK_TOKEN yo -e CLOUDANT_PACKAGE_BINDING mo`, this.app)
       .then(verifyTheBasicStuff(addSubscription.file, 'composerLib'))
       .then(verifyNodeExists('write'))
       .then(verifyNodeExists('read-document'))
       //.then(verifyNodeExists('post'))
       //.then(verifyEdgeExists('post', 'Exit'))
       .catch(common.oops(this)))
})
