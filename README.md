# kessel [![Build Status](https://travis-ci.org/jasonray/kessel.svg?branch=master)](https://travis-ci.org/jasonray/kessel)

"You've never heard of the Millennium Falcon?…It's the ship that made the Kessel Run in less than twelve parsecs."


Developer Set up
----------------
make sure that you have `node` and `npm` installed

clone source code to you local machine

setup dependencies: `npm install`

run tests: `npm test`




jobRequest Model
----------------
id: filled in by the manager
ref: filled in by producer
type
TTL / timeout
delay
priority
callback: either JS f or http endpoint
payload

jobResult Model
---------------
id: 
result: success|failed|failed-transient



Queue Adapter API
-----------------
enqueue(jobRequest)

dequeue(callback)
where callback is a function that returns f(commit)
where commit is a f(jobResult)
