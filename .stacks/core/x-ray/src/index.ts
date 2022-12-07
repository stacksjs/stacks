// import { ray } from 'node-ray'

import request from './http'

// const debug = ray

// export { debug, ray }

function ray(content: any): void {
  request('http://localhost:3000/api/store-logs', 'POST', {
    content,
    file: 'TestController.php',
    expanded: false,
    color: 'indigo',
    time: '09:20:35',
  })
}

export { ray }
