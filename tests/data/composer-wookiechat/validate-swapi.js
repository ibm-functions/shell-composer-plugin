function main(params) {

	//return {status: 'Good', myResult: params.result.body}
	
	var answer = JSON.parse(params.result.body)
	if (answer.count > 0) {
		return {value: true}
	} else {
		{value: false}
	} 
}
