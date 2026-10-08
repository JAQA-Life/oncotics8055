// Explicit Qwen chat-template rendering, validated against the pinned model in CI.
export function countRequest(tokenizer,config,{system,prompt,schema,max_tokens,context_limit}){
 const template=config.conv_template;
 if(!template||!template.system_template.includes('{system_message}')||!template.roles?.user||!template.roles?.assistant||!template.seps?.length)throw Error('Unsupported model chat template for token budgeting.');
 const userTemplate=template.role_templates?.user||'{user_message}',user=userTemplate.replaceAll('{user_message}',prompt),segments=[template.system_template.replaceAll('{system_message}',system),template.roles.user+(template.role_content_sep??': ')+user+template.seps[0],template.roles.assistant+(template.role_empty_sep??': ')];
 const prompt_tokens=segments.reduce((sum,part)=>sum+tokenizer.encode(part).length,0)+(config.tokenizer_info?.prepend_space_in_encode?4:0),schema_allowance=tokenizer.encode(schema).length,safety_margin=128;
 return {prompt_tokens,schema_allowance,output_reserve:max_tokens,safety_margin,context_limit,total_reserved:prompt_tokens+schema_allowance+max_tokens+safety_margin};
}
