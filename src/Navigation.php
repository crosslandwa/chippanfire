<?php

class Navigation {

	private $_pagesMeta;
	private $_homepage;

    function __construct($pagesMeta) {
        $this->_pagesMeta = $pagesMeta;
        $this->_homepage = $this->_pagesMeta[0];
    }

	function render() {
		require 'navigation.phtml';
	}
}