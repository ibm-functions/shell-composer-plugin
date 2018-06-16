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

'use strict'

const composer = require('@ibm-functions/composer')

// build action composition
const app =  composer.retain(composer.sequence('TripleAndIncrement', 'DivideByTwo'))

// output action composition
console.log(JSON.stringify(app, null, 4))

// invoke action composition
const wsk = composer.openwhisk({ignore_certs:true})
function print(obj) { console.log(JSON.stringify(obj.response ? obj.response.result : obj, null, 4)) }
wsk.actions.invoke({ name: 'conductor', params: { $run: app, n: 3 }, blocking: true }).then(print, console.error)
