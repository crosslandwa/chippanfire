<?php

class Header {
	function render() {
		$this->a = '123';
		require 'template/header.phtml';
	}
}
